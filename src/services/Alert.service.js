// services/Alert.service.js
const Building = require('../modules/building/building.model')
const Gateway = require('../modules/gateways/gateway.model')
const { AngleNode } = require('../modules/nodes/angle-node/angleNode.model')
const AlertLog = require('../modules/alertion/alert.model')

/**
 * 게이트웨이가 소속된 빌딩의 alarm_level 기준으로 보정값을 판정하여 yellow/red 로그만 저장
 * @param {Object} p
 * @param {String|Number} p.gateway_serial - 게이트웨이 일련번호
 * @param {Number} p.doorNum               - 노드 번호
 * @param {String} p.metric                - 'angle_x' (⚠️ 'angle_y' 제외)
 * @param {Number|String} p.value          - 측정된 값 (보정 포함)
 * @param {Object} [p.raw]                 - 원본/보조 데이터
 */
async function checkAndLogAngle({
	gateway_serial,
	doorNum,
	metric,
	value,
	raw,
}) {
	// --------- 0) 파라미터 검증 ---------
	// 'angle_y'는 제외: 'angle_x'만 허용
	const allowedMetrics = new Set(['angle_x'])
	if (!allowedMetrics.has(metric)) return null

	const gatewaySerialStr = String(gateway_serial ?? '').trim()
	if (!gatewaySerialStr) return null

	const doorNumInt = Number(doorNum)
	if (!Number.isFinite(doorNumInt)) return null

	const numericValue = Number(value)
	if (!Number.isFinite(numericValue)) return null

	// --------- 1) 게이트웨이 → 빌딩 찾기 ---------
	const gw = await Gateway.findOne(
		{ serial_number: gatewaySerialStr },
		{ _id: 1, building_id: 1 }
	).lean()

	const buildingId = gw?.building_id
	if (!buildingId) {
		// 빌딩 연결 안 된 경우 로그 기록 안 함
		return null
	}

	// --------- 2) 빌딩 알람 레벨 조회 ---------
	const b = await Building.findById(buildingId, { alarm_level: 1 }).lean()
	const yellow = b?.alarm_level?.yellow ?? null
	const red = b?.alarm_level?.red ?? null
	if (yellow == null || red == null) return null

	// --------- 3) 위험 레벨 판정 ---------
	let level = null
	let threshold = null

	if (numericValue >= red) {
		level = 'red'
		threshold = red
	} else if (numericValue >= yellow) {
		level = 'yellow'
		threshold = yellow
	}
	if (!level) return null // 기준 미달 → 로그 저장 안 함

	// --------- 4) 노드 ObjectId 조회 ---------
	const nodeDoc = await AngleNode.findOne(
		{ doorNum: doorNumInt },
		{ _id: 1 }
	).lean()

	// --------- 5) AlertLog 저장 ---------
	const doc = await AlertLog.create({
		building: buildingId,
		gateway: gw?._id ?? null,
		gateway_serial: gatewaySerialStr,
		node: nodeDoc?._id ?? null,
		doorNum: doorNumInt,
		level,
		metric,
		value: numericValue,
		threshold,
		raw: raw ?? null,
		createdAt: new Date(), // ✅ UTC 기준 현재 시간
	})

	return doc
}

module.exports = { checkAndLogAngle }
