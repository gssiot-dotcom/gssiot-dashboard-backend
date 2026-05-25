const express = require('express')
const nodeRouter = express.Router()

const nodeController = require('./node.controller')
const { isAuth } = require('../../middlewares/auth.middleware')
const { isAdmin } = require('../../middlewares/admin.middleware')

// ---------------------------------- Node endpoints ----------------------------- //
// nodeRouter.use(isAuth)

nodeRouter.post('/', isAdmin, nodeController.createNodes)
nodeRouter.get('/', isAdmin, nodeController.getNodes)
nodeRouter.get('/active', isAdmin, nodeController.getActiveNodes)
nodeRouter.get('/graphic-data', nodeController.nodeGraphicData)
nodeRouter.patch('/:id', nodeController.updateNode)

// nodeRouter.patch('/bulk', nodeController.bulkUpdateNodes)
// nodeRouter.patch('/:id/gateway', isAdmin, nodeController.updateNodeGateway)

// nodeRouter.delete('/:id', isAdmin, nodeController.deleteNode)

module.exports = nodeRouter
