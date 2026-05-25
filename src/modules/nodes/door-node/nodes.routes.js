const nodesRouter = require('express').Router()
const doorNodeController = require('./node.controller')

// ---------------------------------- Door Node endpoints ------------------------------ //
nodesRouter.get('/', doorNodeController.getNodes)
nodesRouter.get(
	'/download-nodes-history',
	doorNodeController.downloadNodeHistory,
)
nodesRouter.get(
	'/alltype-active-nodes',
	doorNodeController.getAllTypeActiveNodes,
)

nodesRouter.post('/create-nodes', doorNodeController.createNodes)
// nodesRouter.get('/get-active-nodes', doorNodeController.getActiveNodes)
nodesRouter.post(
	'/combine/to-gateway',
	doorNodeController.combineNodesToGateway,
)

nodesRouter.post('/update-status', doorNodeController.updateNodeStatus)
nodesRouter.delete('/delete', doorNodeController.deleteNode)
nodesRouter.patch('/position', doorNodeController.updateSingleNodePosition)
nodesRouter.get('/report/detail', doorNodeController.downloadDetailedReport)

module.exports = nodesRouter
