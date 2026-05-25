const {
	AngleNode,
	AngleNodeHistory,
	AngleNodeCalibration,
} = require('./angleNode.model')
const GatewaySchema = require('../../gateways/gateway.model')
const { eventBus } = require('../../../shared/eventBus')
const { logger, logError } = require('../../../lib/logger')
const { checkAndLogAngle } = require('../../../services/Alert.service') // sizdagi pathga moslang
const NodeSchema = require('../node.model')
const { ALARM_NODE_TYPES } = require('../../../lib/config')
const { BuildingAlarmLevelSchema } = require('../../building/building.model')
// const { getGatewayContextByLast4 } = require('../../../cache/gatewayContext')
// const { persistQueue } = require('../../../utils/ConcurrencyQueue')
// const {
// 	getCalibratedFromCache,
// 	setCalibrationOffsetCache,
// 	refreshCalibrationOffsetFromDb,
// } = require('../../../cache/calibration')

async function findGatewayByLast4(last4) {
	if (!last4) return null
	return GatewaySchema.findOne({
		serial_number: { $regex: `${last4}$` },
	}).lean()
}

/**
 * 비계전도(AngleNode) 여러 개를 생성하는 서비스
 * @param {Array} arrayData - [{ doorNum }, ...]
 * 1. doorNum 기준 중복 체크
 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
 */
async function createAngleNodesData(arrayData) {
	try {
		// 이미 존재하는 doorNum 이 있는지 확인
		const existNodes = await AngleNode.find({
			doorNum: { $in: arrayData.map(obj => obj.doorNum) },
		})
		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.doorNum)
			throw new Error(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`,
			)
		}

		// AngleNode 는 doorNum 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
		const arrayObject = arrayData.map(({ doorNum }) => ({
			doorNum,
		}))

		const result = await AngleNode.insertMany(arrayObject)
		return result
	} catch (error) {
		throw new Error(`Error: ${error.message}`)
	}
}

/**
 * node_status = true 인 활성 Angle-Node 들만 조회
 * @returns {Array|null}
 */
async function getActiveAngleNodesData() {
	try {
		const angleNodes = await AngleNode.find({ node_status: true })

		return angleNodes
	} catch (error) {
		throw new Error(`Error on getting Angle-Nodes: ${error.message}`)
	}
}

async function getAngleNodePositionByDoorNum(doorNum) {
	try {
		const node = await AngleNode.findOne({ doorNum: Number(doorNum) })
			.select('position save_status')
			.lean()
		return node
	} catch (e) {
		logError('getAngleNodePositionByDoorNum error:', e?.message || e)
		return null
	}
}

/**
 * 노드 상태 토글 (node_status true ↔ false)
 * @param {String} nodeId
 */
async function updateAngleNodeStatusData(nodeId) {
	try {
		// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
		const updatingNode = await AngleNode.findOneAndUpdate(
			{ _id: nodeId },
			[{ $set: { node_status: { $not: '$node_status' } } }],
			{ new: true }, // 변경 후 도큐먼트를 반환
		)

		if (!updatingNode) {
			throw new Error('Node not found')
		}

		return updatingNode
	} catch (error) {
		throw error
	}
}

/**
 * 노드 삭제
 * @param {String} nodeId
 */
async function deleteAngleNodeData(nodeId) {
	try {
		const deletingNode = await this.nodeSchema.findOneAndDelete({
			_id: nodeId,
		})
		if (!deletingNode) {
			throw new Error('Node not found')
		}

		return deletingNode
	} catch (error) {
		console.error('Error deleting node:', error)
		throw error
	}
}

async function handleAngleNodeMqttMessage({ topic, data, gatewayNumberLast4 }) {
	const { doorNum, angle_x, angle_y, nodeType } = data

	if (doorNum == null || angle_x == null) {
		logError('handleAngleNodeMqttMessage: missing required fields', data)
		return
	}

	// 1. Gateway topish (last4 orqali)
	const gateway = await GatewaySchema.findOne({
		serialNumber: { $regex: `${gatewayNumberLast4}$` },
	}).lean()

	if (!gateway) {
		logError(
			'handleAngleNodeMqttMessage: gateway not found',
			gatewayNumberLast4,
		)
		return
	}

	// 2. AlarmLevel topish va status hisoblash (gateway.buildingId orqali)
	const saveStatus = await resolveAngleStatus({
		buildingId: gateway.buildingId,
		angle_x,
		angle_y: angle_y ?? 0,
	})

	// 3. Node topish va angleX/Y yangilash
	const node = await NodeSchema.findOneAndUpdate(
		{
			gatewayId: gateway._id,
			number: doorNum,
		},
		{
			$set: {
				angleX: angle_x,
				angleY: angle_y ?? 0,
				lastSeenAt: new Date(),
				status: saveStatus,
			},
		},
		{ new: true },
	)

	if (!node) {
		logError('handleAngleNodeMqttMessage: node not found', {
			gatewayNumberLast4,
			doorNum,
		})
		return
	}

	logger('handleAngleNodeMqttMessage: node updated', {
		nodeId: node._id,
		angleX: angle_x,
		angleY: angle_y,
		status: saveStatus,
	})

	// 4. Socket orqali frontendga yuborish (tez, history kutmasdan)
	if (gateway.buildingId) {
		eventBus.emit('rt.angle', {
			buildingId: gateway.buildingId.toString(),
			nodeId: node._id,
			nodeNumber: node.number,
			angleX: angle_x,
			angleY: angle_y ?? 0,
			updatedAt: node.updatedAt,
			status: node.status,
		})
	}

	// 5. Tarixga saqlash
	await AngleNodeHistory.create({
		gwNumber: gateway.serialNumber,
		nodeNumber: doorNum,
		angleX: angle_x,
		angleY: angle_y ?? 0,
	})

	logger('handleAngleNodeMqttMessage: history saved', {
		doorNum,
		angle_x,
		angle_y,
	})
}

/**
 * buildingId va angle qiymatlari asosida status qaytaradi
 * @returns {'safe'|'caution'|'warning'|'danger'}
 */
async function resolveAngleStatus({ buildingId, angle_x, angle_y }) {
	if (!buildingId) return 'safe'

	const alarmLevel = await BuildingAlarmLevelSchema.findOne({
		buildingId,
		alarmType: ALARM_NODE_TYPES.ANGLE,
	}).lean()

	// AlarmLevel yo'q yoki barcha qiymatlar 0 bo'lsa — safe
	if (
		!alarmLevel ||
		(!alarmLevel.green && !alarmLevel.yellow && !alarmLevel.red)
	) {
		return 'safe'
	}

	const { green, yellow, red } = alarmLevel

	const getStatus = angle => {
		if (red && angle >= red) return 'danger'
		if (yellow && angle >= yellow) return 'warning'
		if (green && angle >= green) return 'caution'
		return 'safe'
	}

	const statusPriority = { safe: 0, caution: 1, warning: 2, danger: 3 }

	const statusX = getStatus(Math.abs(angle_x))
	const statusY = getStatus(Math.abs(angle_y))

	return statusPriority[statusX] >= statusPriority[statusY] ? statusX : statusY
}

/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setAngleNodePositionData(doorNum, position) {
	const n = Number(doorNum)
	if (!Number.isFinite(n)) {
		throw new Error('doorNum must be a valid number')
	}
	if (!position || typeof position !== 'string') {
		throw new Error('position must be a non-empty string')
	}

	const node = await AngleNode.findOneAndUpdate(
		{ doorNum: n },
		{ $set: { position } },
		{ new: true },
	)

	if (!node) {
		throw new Error(`AngleNode with doorNum ${n} not found`)
	}

	return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{doorNum, position}, ...])
 * @param {Array<{doorNum:number, position:string}>} positions
 */
async function setAngleNodePositionsData(positions) {
	if (!Array.isArray(positions) || positions.length === 0) {
		throw new Error('positions must be a non-empty array')
	}

	const results = []

	for (const item of positions) {
		const n = Number(item.doorNum)
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid doorNum: ${item.doorNum}`)
		}
		if (!item.position || typeof item.position !== 'string') {
			throw new Error(`Invalid position for doorNum: ${item.doorNum}`)
		}

		const node = await AngleNode.findOneAndUpdate(
			{ doorNum: n },
			{ $set: { position: item.position } },
			{ new: true },
		)

		if (!node) {
			throw new Error(`AngleNode with doorNum ${n} not found`)
		}

		results.push(node)
	}

	return results
}

// ====================== functions 류현 added ======================= //
/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setAngleNodePosition(doorNum, position) {
	const n = Number(doorNum)
	if (!Number.isFinite(n)) {
		throw new Error('doorNum must be a valid number')
	}
	if (!position || typeof position !== 'string') {
		throw new Error('position must be a non-empty string')
	}

	const node = await AngleNode.findOneAndUpdate(
		{ doorNum: n },
		{ $set: { position } },
		{ new: true },
	)

	if (!node) {
		throw new Error(`AngleNode with doorNum ${n} not found`)
	}

	return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{doorNum, position}, ...])
 * @param {Array<{doorNum:number, position:string}>} positions
 */
async function setAngleNodePositions(positions) {
	if (!Array.isArray(positions) || positions.length === 0) {
		throw new Error('positions must be a non-empty array')
	}

	const results = []

	for (const item of positions) {
		const n = Number(item.doorNum)
		if (!Number.isFinite(n)) {
			throw new Error(`Invalid doorNum: ${item.doorNum}`)
		}
		if (!item.position || typeof item.position !== 'string') {
			throw new Error(`Invalid position for doorNum: ${item.doorNum}`)
		}

		const node = await AngleNode.findOneAndUpdate(
			{ doorNum: n },
			{ $set: { position: item.position } },
			{ new: true },
		)

		if (!node) {
			throw new Error(`AngleNode with doorNum ${n} not found`)
		}

		results.push(node)
	}

	return results
}

module.exports = {
	createAngleNodesData,
	getActiveAngleNodesData,
	updateAngleNodeStatusData,
	deleteAngleNodeData,
	setAngleNodePositionData,
	setAngleNodePositionsData,
	handleAngleNodeMqttMessage,
	// 류현 added
	setAngleNodePosition,
	setAngleNodePositions,
}

// ======================= MQTT cold path optimizing ======================== //

const lastSeenGate = new Map()
function shouldUpdate(key, everyMs = 10_000) {
	const t = Date.now()
	const last = lastSeenGate.get(key) || 0
	if (t - last < everyMs) return false
	lastSeenGate.set(key, t)
	return true
}

async function getAngleMeta(doorNum) {
	// sening funksiyang:
	// return { position, save_status }
	return getAngleNodePositionByDoorNum(doorNum)
}

async function collectAndMaybeFinalizeCalibration({
	doorNum,
	rawX,
	rawY,
	now,
}) {
	// collecting bo‘lmasa null qaytadi (DB 1 ta call bo‘ladi)
	const doc = await AngleNodeCalibration.findOneAndUpdate(
		{ doorNum, collecting: true },
		{
			$inc: {
				sampleCount: 1,
				sumX: Number(rawX ?? 0),
				sumY: Number(rawY ?? 0),
			},
			$set: { updatedAt: now },
		},
		{ new: true }, // updated doc qaytadi
	).lean()

	if (!doc) return { status: 'not_collecting' }

	const target = doc.sampleTarget ?? 5
	const cnt = doc.sampleCount ?? 0
	const sumX = Number(doc.sumX ?? 0)
	const sumY = Number(doc.sumY ?? 0)

	if (cnt < target) {
		return { status: 'collecting', count: cnt, target }
	}

	// targetga yetdi -> finalize
	const avgX = sumX / cnt
	const avgY = sumY / cnt

	const res = await AngleNodeCalibration.updateOne(
		{ _id: doc._id, collecting: true }, // faqat 1 marta finalize bo‘lsin
		{
			$set: {
				applied: true,
				collecting: false,
				offsetX: avgX,
				offsetY: avgY,
				appliedAt: now,
			},
		},
	)

	if (res.modifiedCount === 1) {
		// ✅ cache’ni yangila (senda setCalibrationOffsetCache bo‘lsa shuni chaqir)
		// Masalan: setCalibrationOffsetCache(doorNum, avgX, avgY)
		setCalibrationOffsetCache(doorNum, avgX, avgY, {
			buildingId,
			applied: true,
		})
		return { status: 'finalized', offsetX: avgX, offsetY: avgY }
	}

	// kimdir finalize qilib bo‘lgan
	return { status: 'already_finalized' }
}

async function persistAngleStuff(payload) {
	const {
		now,
		doorNum,
		gw_number,
		gateway_id,
		buildingId,
		gw_position = '',
		rawX,
		rawY,
		calibratedX: calX_in,
		calibratedY: calY_in,
	} = payload

	try {
		await refreshCalibrationOffsetFromDb(doorNum, buildingId)
		// 1) meta (save_status / position)
		const meta = await getAngleMeta(doorNum)
		const saveAllowed = meta?.save_status !== false
		const node_position = meta?.position ? String(meta.position) : ''

		// 2) alive/lastSeen minimal update (har doim)
		// (eslatma: idealda {buildingId, doorNum} composite key)
		await AngleNode.updateOne(
			{ doorNum },
			{
				$set: {
					lastSeen: now,
					node_alive: true,
					gateway_id,
					buildingId,
				},
			},
			{ upsert: true },
		)

		// gateway lastSeen debounce
		if (gateway_id && shouldUpdate(`gw:${gateway_id}`, 30_000)) {
			await GatewaySchema.updateOne(
				{ _id: gateway_id },
				{ $set: { lastSeen: now, gateway_alive: true } },
			)
		}

		// 3) save_status=false bo‘lsa qolgan hammasini skip (history/alerts/calibration/latest values)
		if (!saveAllowed) {
			return
		}

		// 4) calibration collecting bo‘lsa update/finalize
		// realtime’da cache offset ishlatganmiz. Agar finalize shu msg’da bo‘lsa,
		// DB uchun calibrated’ni yangi offset bilan qayta hisoblaymiz.
		let calibratedX = Number(calX_in ?? 0)
		let calibratedY = Number(calY_in ?? 0)

		const calibRes = await collectAndMaybeFinalizeCalibration({
			doorNum,
			rawX,
			rawY,
			now,
			buildingId,
		})

		if (calibRes.status === 'finalized') {
			calibratedX = Number(rawX ?? 0) - Number(calibRes.offsetX ?? 0)
			calibratedY = Number(rawY ?? 0) - Number(calibRes.offsetY ?? 0)
		}

		calibratedX = parseFloat(calibratedX.toFixed(2))
		calibratedY = parseFloat(calibratedY.toFixed(2))

		// 5) Latest snapshot (raw + calibrated)
		const updatedAngleNode = await AngleNode.findOneAndUpdate(
			{ doorNum },
			{
				$set: {
					angle_x: Number(rawX ?? 0),
					angle_y: Number(rawY ?? 0),
					calibrated_x: calibratedX,
					calibrated_y: calibratedY,
					lastSeen: now,
					node_alive: true,
					gateway_id,
					buildingId,
				},
			},
			{ new: true, upsert: true },
		)

		// 6) History
		await AngleNodeHistory.create({
			gw_number,
			doorNum,
			angle_x: calibratedX,
			angle_y: calibratedY,
			gw_position,
			node_position,
			createdAt: now,
		}).catch(err =>
			logError('AngleNodeHistory 저장 오류:', err?.message || err),
		)

		// 7) Alerts (x2)
		await checkAndLogAngle({
			gateway_serial: String(gw_number),
			doorNum,
			metric: 'angle_x',
			value: Number(calibratedX),
			raw: { angle_x: rawX, angle_y: rawY, calibratedX, calibratedY },
		})

		await checkAndLogAngle({
			gateway_serial: String(gw_number),
			doorNum,
			metric: 'angle_y',
			value: Number(calibratedY),
			raw: { angle_x: rawX, angle_y: rawY, calibratedX, calibratedY },
		})

		return updatedAngleNode
	} catch (err) {
		logError('persistAngleStuff error:', err?.message || err)
	}
}
