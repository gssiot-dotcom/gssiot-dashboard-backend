const router = require('express').Router()
const controller = require('./building.controller')

router.post('/', controller.createBuilding)

router.get('/', controller.buildings)
router.get('/active', controller.activeBuildings)
router.get('/:id', controller.detail)

router.patch('/:id/status', controller.updateStatus)
router.patch('/:id/update', controller.update)
router.patch('/:id/alarm-levels', controller.updateAlarmLevels)

router.get('/:id/workers', controller.workers)

router.delete('/:id', controller.deleteBuilding)

module.exports = router
