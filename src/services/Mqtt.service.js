// services/Mqtt.service.js
const mqtt = require('mqtt')
const NodeHistorySchema = require('../modules/nodes/door-node/node.model')
const NodeSchema = require('../modules/nodes/door-node/node.model')
const EventEmitter = require('events')
// const { notifyUsersOfOpenDoor } = require('../services/Telegrambot.service')
const AngleNodeHistory = require('../modules/nodes/angle-node/angleNode.model')
const AngleNodeSchema = require('../modules/nodes/angle-node/angleNode.model')
const { logger, logError, logInfo } = require('../lib/logger')
const GatewaySchema = require('../modules/gateways/gateway.model')
const AngleCalibration = require('../modules/nodes/angle-node/angleNode.model')

// 메시지를 다른 곳에 전달하기 위해 EventEmitter 사용
const mqttEmitter = new EventEmitter()

// MQTT 토픽 설정
const allTopics = [
	'GSSIOT/01030369081/GATE_PUB/+', // 노드 데이터
	'GSSIOT/01030369081/GATE_RES/+', // 게이트웨이 응답
	'GSSIOT/01030369081/GATE_ANG/+', // 각도 센서 데이터
]
const nodeTopic = 'GSSIOT/01030369081/GATE_PUB/'
const angleTopic = 'GSSIOT/01030369081/GATE_ANG/'
const gwResTopic = 'GSSIOT/01030369081/GATE_RES/'
const verticalNode = 'GSSIOT/01030369081/GATE_VERTICAL/'

// ───────────────────────────────────────────────────────────────
// 헬퍼: gw_number(끝 4자리) → Gateway.serial_number 끝 4자리 매칭 → zone_name
//       doorNum → AngleNode.position (각도 노드 기준)
// ───────────────────────────────────────────────────────────────
async function findGatewayZoneByGwNumber(gwNumber) {
	try {
		const last4 = String(gwNumber || '').slice(-4)
		if (!last4) return ''
		const gw = await GatewaySchema.findOne({
			serial_number: { $regex: `${last4}$` },
		})
			.select('zone_name')
			.lean()
		return gw?.zone_name ? String(gw.zone_name) : ''
	} catch (e) {
		logError('findGatewayZoneByGwNumber error:', e?.message || e)
		return ''
	}
}

async function getAngleNodePositionByDoorNum(doorNum) {
	try {
		const node = await AngleNodeSchema.findOne({ doorNum: Number(doorNum) })
			.select('position')
			.lean()
		return node?.position ? String(node.position) : ''
	} catch (e) {
		logError('getAngleNodePositionByDoorNum error:', e?.message || e)
		return ''
	}
}

// ================= MQTT LOGICS =============== //

// MQTT 서버 연결 (기존 구조 유지)
const mqttClient = mqtt.connect('mqtt://gssiot.iptime.org:10200', {
	username: '01030369081',
	password: 'qwer1234',
	// connectTimeout: 30 * 1000,
})

// 연결 성공 시 구독 처리 (기존 구조 유지)
mqttClient.on('connect', () => {
	logger('Connected to GSSIOT MQTT server')
	allTopics.forEach(topic => {
		mqttClient.subscribe(topic, function (err) {
			if (!err) {
				logger('Subscribed to:', topic)
			} else {
				logError('Error subscribing:', err)
			}
		})
	})
})

// 이전 message 리스너 제거 후 새로 등록
mqttClient.removeAllListeners('message')
mqttClient.on('message', async (topic, message) => {
	try {
		// MQTT 메시지 파싱
		const data = JSON.parse(message.toString())

		// 게이트웨이 번호 추출 (토픽의 마지막 조각 기준) → 끝 4자리 사용 (기존 유지)
		const gatewayNumber = topic.split('/').pop().slice(-4)

		// 현재 시간 (서울 기준, 24시간제)
		const now = new Date()
		const timeString = now.toLocaleString('ko-KR', {
			timeZone: 'Asia/Seoul',
			hour12: false,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})

		// ================== Node 데이터 처리 ==================
		if (topic.startsWith(nodeTopic)) {
			logger('Door-Node mqtt message:', data, '|', timeString)

			// 이벤트 데이터 생성
			const eventData = {
				gw_number: gatewayNumber,
				doorNum: data.doorNum,
				doorChk: data.doorChk,
				betChk: data.betChk_3,
			}

			// DB 업데이트용 데이터
			const updateData = {
				doorChk: data.doorChk,
				betChk: data.betChk_3,
				...(data.betChk_2 !== undefined && { betChk_2: data.betChk_2 }),
			}

			// Node DB 업데이트
			const updatedNode = await NodeSchema.findOneAndUpdate(
				{ doorNum: data.doorNum },
				{ $set: updateData },
				{ new: true },
			)

			if (!updatedNode) {
				logInfo('Node를 찾을 수 없음:', data.doorNum)
				return
			}

			// NodeHistory 저장(요구 없었으므로 기존 그대로)
			const mqttEventSchema = new NodeHistorySchema(eventData)
			try {
				await mqttEventSchema.save()
			} catch (err) {
				logError('NodeHistorySchema 저장 오류:', err.message)
				return
			}

			// 이벤트 전달
			mqttEmitter.emit('mqttMessage', updatedNode)

			// if (data.doorChk === 1) { await notifyUsersOfOpenDoor(data.doorNum) }
		}

		// ================== Gateway 응답 처리 ==================
		else if (topic.startsWith(gwResTopic)) {
			logger(
				`Gateway-creation event gateway-${gatewayNumber}:`,
				data,
				'|',
				timeString,
			)
			emitGwRes(data)
		}

		// ================== 각도 센서 데이터 처리 ==================
		else if (topic.startsWith(angleTopic)) {
			logger(
				`MPU-6500 sensor data from gateway-${gatewayNumber}:`,
				data,
				'|',
				timeString,
			)

			const payload = {
				doorNum: data.doorNum,
				gateway_number: gatewayNumber,
				angle_x: data.angle_x,
				angle_y: data.angle_y,
			}

			await handleIncomingAngleNodeData(payload)
		}
	} catch (err) {
		logError('MQTT 메시지 처리 오류:', err.message)
	}
})

// MQTT 연결 오류 처리
mqttClient.on('error', error => {
	logError('MQTT connection error:', error)
})

// 게이트웨이 응답 이벤트 전달 함수
const emitGwRes = data => {
	mqttEmitter.emit('gwPubRes', data)
}

// ───────────────────────────────────────────────────────────────
// 각도 노드 처리 (save_status 가드만 추가된 최소 변경)
// ───────────────────────────────────────────────────────────────
async function handleIncomingAngleNodeData(payload) {
	const { gateway_number, doorNum, angle_x, angle_y } = payload
	const now = new Date()

	// Node 상태 업데이트 (lastSeen / alive)
	await AngleNodeSchema.updateOne(
		{ doorNum },
		{ $set: { lastSeen: now, node_alive: true } },
		{ upsert: true },
	)

	// Gateway 상태 업데이트 (lastSeen / alive)
	await GatewaySchema.updateOne(
		{ serial_number: gateway_number },
		{
			$set: { lastSeen: now, gateway_alive: true },
			$setOnInsert: {},
		},
		{ upsert: true },
	)

	// save_status 가드
	try {
		const nodeDoc = await AngleNodeSchema.findOne({ doorNum }).lean()
		const saveAllowed = nodeDoc?.save_status !== false // 기본 true
		if (!saveAllowed) {
			mqttEmitter.emit('mqttAngleMessage', {
				doorNum,
				angle_x,
				angle_y,
				gw_number: gateway_number,
				node_alive: true,
				lastSeen: now,
				save_skipped: true,
			})
			logger(
				`save_status=false → 값 저장/히스토리/알림/보정 스킵 (door ${doorNum})`,
			)
			return
		}
	} catch (e) {
		logError('save_status 확인 중 오류:', e?.message || e)
	}

	// ===== 보정값 조회/수집 처리 =====
	let calibDoc = await AngleCalibration.findOne({ doorNum }).lean()

	if (calibDoc?.collecting) {
		const newCount = (calibDoc.sampleCount ?? 0) + 1
		const newSumX = (calibDoc.sumX ?? 0) + Number(angle_x ?? 0)
		const newSumY = (calibDoc.sumY ?? 0) + Number(angle_y ?? 0)
		const target = calibDoc.sampleTarget ?? 5

		if (newCount >= target) {
			// 평균 계산 후 offset 확정
			const avgX = newSumX / newCount
			const avgY = newSumY / newCount

			await AngleCalibration.updateOne(
				{ doorNum },
				{
					$set: {
						applied: true,
						collecting: false,
						offsetX: avgX,
						offsetY: avgY,
						appliedAt: new Date(),
						sampleCount: newCount,
						sumX: newSumX,
						sumY: newSumY,
					},
				},
			)

			// 메모리 최신 상태 반영
			calibDoc = {
				...calibDoc,
				applied: true,
				collecting: false,
				offsetX: avgX,
				offsetY: avgY,
				sampleCount: newCount,
				sumX: newSumX,
				sumY: newSumY,
			}

			logger(
				`Calibration 확정(door ${doorNum}) → offsetX=${avgX}, offsetY=${avgY}`,
			)
		} else {
			await AngleCalibration.updateOne(
				{ doorNum },
				{
					$set: {
						sampleCount: newCount,
						sumX: newSumX,
						sumY: newSumY,
					},
				},
			)
			logger(`Calibration 수집 중 (door ${doorNum}) ${newCount}/${target}`)
		}
	}

	// 최종 offset
	const offsetX = calibDoc?.applied ? (calibDoc.offsetX ?? 0) : 0
	const offsetY = calibDoc?.applied ? (calibDoc.offsetY ?? 0) : 0

	// 보정 적용
	let calibratedX = Number(angle_x ?? 0) - offsetX
	let calibratedY = Number(angle_y ?? 0) - offsetY
	calibratedX = parseFloat(calibratedX.toFixed(2))
	calibratedY = parseFloat(calibratedY.toFixed(2))

	// Angle-Node 최신값(원시+보정) 업데이트
	const updatedAngleNode = await AngleNodeSchema.findOneAndUpdate(
		{ doorNum },
		{
			$set: {
				angle_x: Number(angle_x ?? 0), // raw
				angle_y: Number(angle_y ?? 0), // raw
				calibrated_x: calibratedX, // 보정
				calibrated_y: calibratedY, // 보정
				lastSeen: now,
				node_alive: true,
			},
		},
		{ new: true, upsert: true },
	)

	// ★ gw_position / node_position 계산 (여기가 핵심)
	const gw_position = await findGatewayZoneByGwNumber(gateway_number) // gw_number(끝4) → Gateway.zone_name
	const node_position = await getAngleNodePositionByDoorNum(doorNum) // AngleNode.position

	// AngleNodeHistory: 보정값 + 위치 스냅샷 저장 (position 필드 사용 금지)
	await new AngleNodeHistory({
		gw_number: gateway_number,
		doorNum,
		angle_x: calibratedX,
		angle_y: calibratedY,
		gw_position, // 게이트웨이 zone_name
		node_position, // 노드 position
	})
		.save()
		.catch(err => logError('AngleNodeHistory 저장 오류:', err?.message || err))

	// 알림 로직 (보정값 기준)
	const { checkAndLogAngle } = require('./Alert.service')
	await checkAndLogAngle({
		gateway_serial: String(gateway_number),
		doorNum,
		metric: 'angle_x',
		value: Number(calibratedX),
		raw: { angle_x, angle_y, calibratedX, calibratedY },
	})
	await checkAndLogAngle({
		gateway_serial: String(gateway_number),
		doorNum,
		metric: 'angle_y',
		value: Number(calibratedY),
		raw: { angle_x, angle_y, calibratedX, calibratedY },
	})

	// 이벤트 전달
	mqttEmitter.emit('mqttAngleMessage', updatedAngleNode)
}

// 내보내기
module.exports = { mqttEmitter, mqttClient }
