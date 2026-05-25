const router = require('express').Router()
const { isAdmin } = require('../../middlewares/admin.middleware')
const { isAuth } = require('../../middlewares/auth.middleware')
const controller = require('./gateway.controller')

router.use(isAuth)

router.post('/', isAdmin, controller.createGateway)

router.get('/', isAdmin, controller.gateways)
router.get('/active', isAdmin, controller.activeGateways)

router.get('/:id', controller.detail)

router.patch('/:id/status', isAdmin, controller.updateStatus)
router.patch('/:id/update', isAdmin, controller.update)

router.patch('/assign-building', controller.assignBuilding)
router.patch('/:id/unassign-building', controller.unassignBuilding)

router.post('/:id/connect/nodes', controller.connectNodesToGateway)
router.post('/wake-up', isAdmin, controller.makeWakeUpOfficeGateway)
router.delete('/:id', isAdmin, controller.deleteGateway)

module.exports = router
