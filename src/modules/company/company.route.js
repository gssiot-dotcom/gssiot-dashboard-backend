const router = require('express').Router()
const controller = require('./company.controller')

router.post('/', controller.createCompany)

router.get('/', controller.companies)
router.get('/active', controller.activeCompanies)
router.get('/:id', controller.detail)
router.get('/:id/buildings', controller.buildings)

router.patch('/:id/status', controller.updateStatus)
router.patch('/:id/update', controller.update)

router.patch('/:id/assign-buildings', controller.assignBuildings)
router.patch('/:id/unassign-buildings', controller.unassignBuildings)

router.get('/:id/members', controller.members)
router.post('/:id/managers', controller.assignManagers)
router.post(
	'/:id/buildings/:buildingId/workers',
	controller.assignWorkersToBuilding,
)

router.delete('/:id', controller.deleteCompany)

module.exports = router
