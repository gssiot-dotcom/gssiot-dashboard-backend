const angleNodeRouter = require('express').Router()
const uploadImage = require('../../../middlewares/uploadImage')
const angleNodeController = require('./angleNode.controller')

// ---------------------------------- Angle Node endpoints ----------------------------- //
angleNodeRouter.get('/active', angleNodeController.getActiveAngleNodes)
angleNodeRouter.get('/graphic-data', angleNodeController.angleNodeGraphicData)
/**
 * GET /api/angle-nodes/alive
 * 전체/필터 기준 node_alive 목록 조회
 *   - 쿼리:
 *       gateway_id: 특정 게이트웨이 ObjectId 필터 (옵션)
 *       alive: true|false (옵션, 생존 여부 필터)
 *       doorNums: "1,2,3" (옵션, 특정 도어번호들만)
 *   - 응답: [{ doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }]
 */
angleNodeRouter.get('/alive', angleNodeController.getAliveAngleNodes)

/**
 * 상태 조회 (전체 또는 쿼리로 일부)
 * GET /api/angles/calibration?doorNums=1,2,3
 */
angleNodeRouter.get(
	'/angles/calibration',
	angleNodeController.angleNodesCalibration,
)

/**
 * GET /api/angle-nodes/:doorNum/alive
 * 단일 도어번호의 node_alive 상태 조회
 *   - 응답: { doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }
 */
angleNodeRouter.get(
	'/:doorNum/alive',
	angleNodeController.getAngleNodeAliveByDoorNum,
)
/**
 * 각도 히스토리 최신 1건 조회
 * GET /api/angles/history/latest?doorNum=123
 * - doorNum 미지정 시: 전체에서 최신 1건
 * - doorNum 지정 시: 해당 도어의 최신 1건
 */
angleNodeRouter.get(
	'/angles/history/latest',
	angleNodeController.getAngleNodeLatestHistory,
)

angleNodeRouter.post('/create', angleNodeController.createAngleNodes)
angleNodeRouter.post(
	'/combine/to-gateway',
	angleNodeController.combineAngleNodeToGateway,
)
/**
 * 보정 수집 시작 (전체/부분/단일)
 * POST /api/angles/calibration/start-all
 * body: { doorNum?: number|string, doorNums?: number[] | "1,2,3", sampleTarget?: number|string }
 */
angleNodeRouter.post(
	'/angles/calibration/start-all',
	angleNodeController.angleNodeCalibrationStartAll,
)
/**
 * 보정 수집 취소/리셋 (전체/부분/단일)
 * POST /api/angles/calibration/cancel-all
 * body: { doorNum?: number|string, doorNums?: number[] | "1,2,3", resetOffset?: boolean }
 */
angleNodeRouter.post(
	'/angles/calibration/cancel-all',
	angleNodeController.angleNodeCalibrationCancelAll,
)

// angleNodeRouter.put(
// 	'/angle-node/:id',
// 	uploadImage.single('image'),
// 	angleNodeController.uploadAngleNodeImage,
// )

angleNodeRouter.put(
	'/angle-node/position',
	angleNodeController.setAngleNodePosition,
)
/**
 * PUT /api/angle-nodes/position
 * body 형식:
 *  - 단일: { "doorNum": 10, "position": "B-2구간-7층" }
 *  - 여러 개: [ { doorNum: 10, position: "..." }, { doorNum: 11, position: "..." } ]
 */
angleNodeRouter.put('/position', angleNodeController.changeAngleNodesPosition)

/**
 * PATCH /api/angle-nodes/:doorNum/gateway
 * body: { "gateway_id": "ObjectId or null" }
 */
angleNodeRouter.patch(
	'/:doorNum/gateway',
	angleNodeController.updateAngleNodeGateway,
)

// [단일] 특정 doorNum의 save_status 변경(+ 변경 시각 기록)
// PATCH /api/angle-nodes/:doorNum/save-status
// body: { "save_status": true | false }
angleNodeRouter.patch(
	'/:doorNum/save-status',
	angleNodeController.angleNodeSaveStatusChange,
)

// [배치] 여러 doorNum의 save_status 일괄 변경(+ 변경된 항목만 시각 기록)
// PATCH /api/angle-nodes/save-status
// body: { "doorNums": [47,48,...], "save_status": true|false }
angleNodeRouter.patch(
	'/save-status',
	angleNodeController.angleNodesChangeSaveStatusMany,
)

module.exports = angleNodeRouter
