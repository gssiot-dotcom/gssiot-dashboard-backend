const { logger, logError } = require('../../../lib/logger')
const GatewayServie = require('../../gateways/gateway.service')
const AngleNodeService = require('./angleNode.mqtt.service')
const {
	AngleNode,
	AngleNodeCalibration,
	AngleNodeHistory,
} = require('./angleNode.model')
const Gateway = require('../../gateways/gateway.model')

// controller 객체 생성
let angleNodeController = module.exports

/**
 * POST /api/angle-nodes
 * 비계전도(Angle-Node)를 여러 개 생성하는 컨트롤러입니다.
 * - req.body 가 배열인지 확인
 * - ProductService.createAngleNodesData 를 호출해 doorNum 기준으로 생성
 */
angleNodeController.createAngleNodes = async (req, res) => {
	try {
		logger('request: createAngleNodes')
		const angleNodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(angleNodes)) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid data format. Expected an array.',
			})
		}

		// Angle-Node 생성 (중복 doorNum 체크)
		const createdNodes = await AngleNodeService.createAngleNodesData(angleNodes)

		res.json({
			state: 'succcess',
			message: `${createdNodes.length} angle nodes created successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

angleNodeController.getActiveAngleNodes = async (req, res) => {
	try {
		logger('request: getActiveAngleNodes')
		// 활성 Angle-Node 조회
		const angleNodes = AngleNodeService.getActiveAngleNodesData()

		if (!angleNodes) {
			return res.status(404).json({
				state: 'fail',
				message: '동작 가능한 비계전도 노드가 없습니다.',
			})
		}

		res.status(200).json({
			state: 'success',
			angle_nodes: angleNodes,
		})
	} catch (error) {
		console.error('Error:', error.message)
		res.status(500).json({
			state: 'fail',
			message: 'Internal Server error',
			detail: error.message,
		})
	}
}

/**
 * POST /api/gateways/angle-nodes/combine
 * 비계전도 노드들을 특정 게이트웨이에 할당(묶기)하는 컨트롤러입니다.
 * - body: { gateway_id, serial_number, angle_nodes:[...ObjectId] }
 * - 내부에서 MQTT 로 angle-node 설정도 함께 전송합니다.
 */
angleNodeController.combineAngleNodeToGateway = async (req, res) => {
	try {
		logger('request: combineAngleNodeToGateway:')
		const data = req.body
		// 게이트웨이와 Angle-Node 를 연결하는 비즈니스 로직
		await GatewayServie.combineAngleNodeToGatewayData(data)

		return res.json({
			state: 'succcess',
			message: '비계전도 노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/products/status
 * 노드 또는 게이트웨이의 상태(on/off)를 토글하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: node_status 를 반전
 * - GATEWAY: gateway_status 를 반전
 */
angleNodeController.updateProductStatus = async (req, res) => {
	try {
		logger('POST: reActivateNode')
		const { product_type, product_id } = req.body

		if (product_type === 'ANGLE_NODE') {
			// 노드 활성/비활성 상태 토글
			const result =
				await AngleNodeService.updateAngleNodeStatusData(product_id)
			return res.json({
				state: 'success',
				updated_node: result,
			})
		}
		// 정의되지 않은 타입에 대한 에러 응답
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/products/delete
 * 노드 또는 게이트웨이를 삭제하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: 노드 단건 삭제
 * - GATEWAY: 게이트웨이 삭제 + 포함된 노드 node_status true 로 복구
 */
angleNodeController.deleteAngleNode = async (req, res) => {
	try {
		logger('POST: deleteProduct')
		const { product_type, product_id } = req.body

		if (product_type === 'ANGLE_NODE') {
			// 노드 삭제
			const result = await AngleNodeService.deleteAngleNodeData(product_id)
			return res.json({
				state: 'success',
				deleted: result,
			})
		}

		// 타입이 잘못된 경우
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/angle-nodes/positions
 * 각 비계전도 노드의 위치(position)를 문자열로 일괄 설정하는 컨트롤러입니다.
 * - body: [{ doorNum, position }, ...]
 * - ProductService.setAngleNodePositionData 를 호출해 doorNum 기준으로 position 업데이트
 */
angleNodeController.setAngleNodePosition = async (req, res) => {
	try {
		// body 전체를 positions 배열로 사용
		const positions = req.body

		// 요청 데이터가 배열이고 비어있지 않은지 검증
		if (!Array.isArray(positions) || positions.length === 0) {
			return res.status(400).json({
				message: 'Positions is needed, please enter angle-node positions ',
			})
		}

		// doorNum 별 Angle-Node position 업데이트
		const result = await AngleNodeService.setAngleNodePositionData(positions)

		return res.status(200).json({
			state: 'success',
			message: result.message,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/angle-nodes/:id/image
 * 비계전도 노드의 이미지를 업로드하고, position 도 함께 수정하는 컨트롤러입니다.
 * - params: { id: nodeId }
 * - body: { node_position }
 * - file: req.file (multer 등으로 업로드된 이미지 파일)
 * - ProductService.uploadAngleNodeImageData 가
 *   기존 이미지 삭제 + 새 이미지 파일명 저장 + position 업데이트까지 처리합니다.
 */
angleNodeController.uploadAngleNodeImage = async (req, res) => {
	try {
		console.log('EditNode Request ')
		const nodeId = req.params.id
		const { node_position } = req.body

		// 업로드 파일 존재 확인
		if (!req.file) {
			return res.status(400).json({ message: 'No file uploaded' })
		}
		// nodeId 필수 체크
		if (!nodeId) {
			return res.status(400).json({ message: 'node_id is needed' })
		}

		// multer 에 의해 저장된 파일명 (또는 path)
		const imageUrl = req.file.filename

		// 기존 이미지 삭제 + 새 이미지 및 위치 정보 저장
		const result = await AngleNodeService.uploadAngleNodeImageData(
			nodeId,
			node_position,
			imageUrl,
		)

		return res.status(200).json({
			state: 'success',
			message: 'Angle-node image uploaded successfully!',
			building: result,
		})
	} catch (error) {
		logError(error)
		return res.status(500).json({ state: 'fail', message: error.message })
	}
}

// ========================== Angle-Node-Graphic routes ================================== //

/**
 * GET /api/angle-nodes/graphic?doorNum=10&from=2025-01-01&to=2025-01-02
 * 특정 비계전도 노드(doorNum)의 각도 히스토리를 그래프용으로 리턴하는 컨트롤러입니다.
 * - AngleNodeHistory 컬렉션에서 doorNum 및 createdAt 범위로 조회 후 시간순 정렬
 * - 응답: [{ doorNum, angle_x, angle_y, position, createdAt, ... }, ...]
 * 프론트에서 이 데이터를 사용하여 차트(그래프)를 그릴 수 있습니다.
 */
angleNodeController.angleNodeGraphicData = async (req, res) => {
	logger('request: angleNodeGraphicData')

	try {
		const { doorNum, from, to } = req.query

		// 필수 쿼리 파라미터 확인
		if (!doorNum || !from || !to) {
			return res.status(400).json({ message: 'doorNum, from, to required' })
		}

		// AngleNodeHistory 에서 doorNum + 기간 조건으로 조회
		const data = await AngleNodeHistory.find({
			doorNum: parseInt(doorNum),
			createdAt: {
				$gte: new Date(from),
				$lte: new Date(to),
			},
		}).sort({ createdAt: 1 }) // 시간순 정렬(오름차순)

		res.json(data)
	} catch (err) {
		console.error('Error fetching data:', err)
		res.status(500).json({ message: 'Server error' })
	}
}

// ========================= Angle-Node 류현 added =============================== //

// ---- 유틸: doorNum 파싱(문자/숫자/배열/콤마문자열 모두 허용) ----
function parseDoorNums(reqBody = {}, allDoors = []) {
	// 우선순위: doorNum > doorNums(array) > doorNums(string "1,2,3") > (없으면 전체)
	const out = new Set()

	// 1) 단일 doorNum
	if (reqBody.doorNum !== undefined && reqBody.doorNum !== null) {
		const n = Number(reqBody.doorNum)
		if (Number.isFinite(n)) out.add(n)
	}

	// 2) 배열 doorNums
	if (Array.isArray(reqBody.doorNums)) {
		for (const v of reqBody.doorNums) {
			const n = Number(v)
			if (Number.isFinite(n)) out.add(n)
		}
	}

	// 3) 콤마 문자열 doorNums: "1,2,3"
	if (typeof reqBody.doorNums === 'string') {
		for (const s of reqBody.doorNums.split(',')) {
			const n = Number(s.trim())
			if (Number.isFinite(n)) out.add(n)
		}
	}

	// 아무것도 못 뽑았으면 전체
	if (out.size === 0) return [...allDoors]
	return [...out]
}
// ---- 유틸: sampleTarget 파싱(문자도 허용, 기본 5) ----
function parseSampleTarget(v) {
	const n = Number.parseInt(v, 10)
	return Number.isFinite(n) && n > 0 ? n : 5
}
// ✅ 공통: 정수 도어번호 파싱
function toDoorNum(v) {
	const n = Number(v)
	if (!Number.isFinite(n)) return null
	return Math.trunc(n)
}

angleNodeController.angleNodeCalibrationStartAll = async (req, res) => {
	try {
		// 등록된 도어 목록(없으면 에러)
		const allDoors = await AngleNode.distinct('doorNum')
		if (!allDoors?.length) {
			return res
				.status(400)
				.json({ message: 'No doors registered in AngleNode' })
		}

		const doors = parseDoorNums(req.body, allDoors)
		if (!doors.length) {
			return res
				.status(400)
				.json({ message: 'No valid doors resolved from request' })
		}

		const target = parseSampleTarget(req.body?.sampleTarget)
		const now = new Date()

		const ops = doors.map(dn => ({
			updateOne: {
				filter: { doorNum: dn },
				update: {
					$set: {
						applied: false,
						offsetX: 0,
						offsetY: 0,
						collecting: true,
						sampleTarget: target,
						sampleCount: 0,
						sumX: 0,
						sumY: 0,
						startedAt: now,
					},
				},
				upsert: true,
			},
		}))

		const result = await AngleNodeCalibration.bulkWrite(ops, { ordered: false })

		return res.json({
			message: `Calibration collecting started for ${doors.length} door(s)`,
			target,
			doors, // ✅ 무엇을 대상으로 했는지 응답에서 바로 확인 가능
			matched: result.matchedCount ?? undefined,
			upserted: result.upsertedCount ?? undefined,
			modified: result.modifiedCount ?? undefined,
		})
	} catch (e) {
		logError('[start-all] error:', e)
		return res.status(500).json({ message: 'Failed to start calibration' })
	}
}

angleNodeController.angleNodeCalibrationCancelAll = async (req, res) => {
	try {
		const allDoors = await AngleNode.distinct('doorNum')
		if (!allDoors?.length) {
			return res
				.status(400)
				.json({ message: 'No doors registered in AngleNode' })
		}

		const doors = parseDoorNums(req.body, allDoors)
		if (!doors.length) {
			return res
				.status(400)
				.json({ message: 'No valid doors resolved from request' })
		}

		const resetOffset = !!req.body?.resetOffset

		const set = {
			collecting: false,
			sampleCount: 0,
			sumX: 0,
			sumY: 0,
			startedAt: null,
		}
		if (resetOffset) {
			set.applied = false
			set.offsetX = 0
			set.offsetY = 0
			set.appliedAt = null
		}

		const result = await AngleNodeCalibration.updateMany(
			{ doorNum: { $in: doors } },
			{ $set: set },
		)

		return res.json({
			message: `Calibration collecting canceled for ${doors.length} door(s)`,
			resetOffset,
			doors, // ✅ 무엇을 대상으로 했는지 응답에서 확인
			matched: result.matchedCount ?? undefined,
			modified: result.modifiedCount ?? undefined,
		})
	} catch (e) {
		console.error('[cancel-all] error:', e)
		return res.status(500).json({ message: 'Failed to cancel calibration' })
	}
}

angleNodeController.angleNodesCalibration = async (req, res) => {
	try {
		let filter = {}
		if (typeof req.query.doorNums === 'string' && req.query.doorNums.trim()) {
			const doors = req.query.doorNums
				.split(',')
				.map(s => Number(s.trim()))
				.filter(Number.isFinite)
			if (doors.length) filter = { doorNum: { $in: doors } }
		}

		const list = await AngleNodeCalibration.find(filter).lean()
		return res.json({ count: list.length, calibrations: list })
	} catch (e) {
		console.error('[get] error:', e)
		return res.status(500).json({ message: 'Failed to get calibrations' })
	}
}

angleNodeController.angleNodeSaveStatusChange = async (req, res) => {
	try {
		const doorNum = Number(req.params.doorNum)
		const { save_status } = req.body

		if (!Number.isFinite(doorNum)) {
			return res
				.status(400)
				.json({ ok: false, message: 'doorNum이 유효하지 않습니다.' })
		}
		if (typeof save_status !== 'boolean') {
			return res
				.status(400)
				.json({ ok: false, message: 'save_status(boolean) 값이 필요합니다.' })
		}

		// 현재 값 확인
		const current = await AngleNode.findOne({ doorNum }).lean()
		if (!current) {
			return res.status(404).json({
				ok: false,
				message: `doorNum=${doorNum} 노드를 찾을 수 없습니다.`,
			})
		}

		// 값이 동일하면 변경 없이 그대로 반환 (변경 시각도 그대로 유지)
		if (current.save_status === save_status) {
			return res.json({
				ok: true,
				message: `변경 없음: doorNum=${doorNum} save_status는 이미 ${save_status} 입니다.`,
				data: {
					doorNum: current.doorNum,
					save_status: current.save_status,
					save_status_lastSeen: current.save_status_lastSeen,
				},
			})
		}

		// 값이 다르면 save_status와 save_status_lastSeen 갱신
		const now = new Date()
		const updated = await AngleNode.findOneAndUpdate(
			{ doorNum },
			{ $set: { save_status, save_status_lastSeen: now } },
			{ new: true },
		)

		return res.json({
			ok: true,
			message: `doorNum=${doorNum} save_status가 ${save_status}로 변경되었습니다.`,
			data: {
				doorNum: updated.doorNum,
				save_status: updated.save_status,
				save_status_lastSeen: updated.save_status_lastSeen,
			},
		})
	} catch (err) {
		return res.status(500).json({ ok: false, message: err.message })
	}
}

angleNodeController.angleNodesChangeSaveStatusMany = async (req, res) => {
	try {
		const { doorNums, save_status } = req.body

		if (!Array.isArray(doorNums) || doorNums.length === 0) {
			return res
				.status(400)
				.json({ ok: false, message: 'doorNums 배열이 필요합니다.' })
		}
		if (typeof save_status !== 'boolean') {
			return res
				.status(400)
				.json({ ok: false, message: 'save_status(boolean) 값이 필요합니다.' })
		}

		const now = new Date()

		// 현재 값과 다른 문서만 갱신
		const filter = {
			doorNum: { $in: doorNums.map(Number) },
			save_status: { $ne: save_status },
		}
		const update = { $set: { save_status, save_status_lastSeen: now } }

		const result = await AngleNode.updateMany(filter, update)

		return res.json({
			ok: true,
			message: `요청 ${doorNums.length}개 중 ${result.matchedCount}개 매칭, ${result.modifiedCount}개 변경.`,
			data: {
				matchedCount: result.matchedCount,
				modifiedCount: result.modifiedCount,
				save_status: save_status,
				save_status_lastSeen: now,
			},
		})
	} catch (err) {
		return res.status(500).json({ ok: false, message: err.message })
	}
}

angleNodeController.getAliveAngleNodes = async (req, res) => {
	try {
		const { gateway_id, alive, doorNums } = req.query
		const q = {}

		if (gateway_id) q.gateway_id = gateway_id
		if (alive === 'true') q.node_alive = true
		if (alive === 'false') q.node_alive = false

		if (doorNums) {
			const list = String(doorNums)
				.split(',')
				.map(s => toDoorNum(s.trim()))
				.filter(n => n !== null)
			if (list.length > 0) q.doorNum = { $in: list }
		}

		const rows = await AngleNode.find(q)
			.select(
				'doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen',
			)
			.sort({ doorNum: 1 })
			.lean()

		// save_status가 없는 문서는 기본 true로 보이도록 정규화
		const normalized = rows.map(r => ({
			...r,
			save_status: r.save_status === undefined ? true : r.save_status,
		}))

		res.json(normalized)
	} catch (err) {
		console.error(err)
		res.status(500).json({ message: 'Failed to fetch node_alive list' })
	}
}

angleNodeController.changeAngleNodesPosition = async (req, res) => {
	try {
		const body = req.body

		// 배열인지 단일 객체인지에 따라 분기
		if (Array.isArray(body)) {
			const updated = await AngleNodeService.setAngleNodePositions(body)
			return res.status(200).json({
				state: 'success',
				count: updated.length,
				angle_nodes: updated,
			})
		} else {
			const { doorNum, position } = body
			if (doorNum === undefined || position === undefined) {
				return res.status(400).json({
					state: 'fail',
					message: 'doorNum and position are required',
				})
			}

			const updated = await AngleNodeService.setAngleNodePosition(
				doorNum,
				position,
			)

			return res.status(200).json({
				state: 'success',
				angle_node: updated,
			})
		}
	} catch (error) {
		console.error('Error on setting angle-node position:', error.message)
		return res.status(500).json({
			state: 'fail',
			message: error.message,
		})
	}
}

angleNodeController.getAngleNodeAliveByDoorNum = async (req, res) => {
	try {
		const doorNum = toDoorNum(req.params.doorNum)
		if (doorNum === null) {
			return res.status(400).json({ message: 'Invalid doorNum' })
		}

		const doc = await AngleNode.findOne({ doorNum })
			.select(
				'doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen',
			)
			.lean()

		if (!doc) {
			return res.status(404).json({ message: 'Angle node not found' })
		}

		// save_status가 없는 문서는 기본 true로 보이도록 정규화
		const normalized = {
			...doc,
			save_status: doc.save_status === undefined ? true : doc.save_status,
		}

		res.json(normalized)
	} catch (err) {
		console.error(err)
		res.status(500).json({ message: 'Failed to fetch node_alive' })
	}
}

angleNodeController.updateAngleNodeGateway = async (req, res) => {
	try {
		const doorNum = toDoorNum(req.params.doorNum)
		if (doorNum === null) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid doorNum',
			})
		}

		const { gateway_id } = req.body

		// gateway_id 필수 (단 null은 허용: "할당 해제")
		if (gateway_id === undefined) {
			return res.status(400).json({
				state: 'fail',
				message: 'gateway_id is required (can be null)',
			})
		}

		// // ✅ 5-1) ObjectId 형식 검증
		// if (gateway_id !== null && !mongoose.Types.ObjectId.isValid(gateway_id)) {
		// 	return res.status(400).json({
		// 		state: 'fail',
		// 		message: 'Invalid gateway_id',
		// 	})
		// }

		// ✅ 5-2) Gateway 실제 존재 검증
		if (gateway_id !== null) {
			const gw = await Gateway.findById(gateway_id).lean()
			if (!gw) {
				return res.status(404).json({
					state: 'fail',
					message: 'Gateway not found',
				})
			}
		}

		const updated = await AngleNode.findOneAndUpdate(
			{ doorNum },
			{ gateway_id },
			{ new: true },
		)
			.select('doorNum gateway_id node_status node_alive lastSeen updatedAt')
			.lean()

		if (!updated) {
			return res.status(404).json({
				state: 'fail',
				message: 'Angle node not found',
			})
		}

		return res.status(200).json({
			state: 'success',
			angle_node: updated,
		})
	} catch (err) {
		console.error(err)
		return res.status(500).json({
			state: 'fail',
			message: err.message,
		})
	}
}

angleNodeController.getAngleNodeLatestHistory = async (req, res) => {
	try {
		const filter = {}
		if (req.query.doorNum !== undefined && req.query.doorNum !== null) {
			const n = Number(req.query.doorNum)
			if (!Number.isFinite(n)) {
				return res.status(400).json({ message: 'Invalid doorNum' })
			}
			filter.doorNum = n
		}

		// createdAt(타임스탬프) 우선 정렬, 없을 때 _id 역순으로 근사 최신
		const latest = await AngleNodeHistory.findOne(filter)
			.sort({ createdAt: -1, _id: -1 })
			.lean()

		if (!latest) {
			return res.status(404).json({ message: 'No angle history found' })
		}

		return res.json({ history: latest })
	} catch (e) {
		logError('[angles/history/latest] error:', e)
		return res
			.status(500)
			.json({ message: 'Failed to get latest angle history' })
	}
}
