const verticalNodeRouter = require('express').Router()
const verticalNodeController = require('./vertical.node.controller')

// -------------------------------- Vertical Node endpoints -------------------------------//
verticalNodeRouter.get('/', verticalNodeController.getVerticalNodes)
verticalNodeRouter.get(
	'/gateway/:gatewayId',
	verticalNodeController.getVerticalNodesByGatewayId,
)

verticalNodeRouter.post('/create', verticalNodeController.createVerticalNodes)
// ---- Need to be completed
verticalNodeRouter.post(
	'/combine/to-gateway',
	verticalNodeController.combineVerticalNodesToGateway,
)

verticalNodeRouter.delete(
	'/:verticalNodeId',
	verticalNodeController.deleteVerticalNodeById,
)
verticalNodeRouter.patch(
	'/:verticalNodeId/status',
	verticalNodeController.updateVerticalNodeStatus,
)

// 라우터와 컨트롤러 함수 연결

verticalNodeRouter.patch(
	'/verticalnode/:node_number',
	verticalNodeController.updateLocation,
)

module.exports = verticalNodeRouter
