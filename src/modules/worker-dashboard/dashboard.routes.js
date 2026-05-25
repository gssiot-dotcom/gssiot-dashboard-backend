const router = require('express').Router()
const { isAuth } = require('../../middlewares/auth.middleware')
const { isWorker } = require('../../middlewares/role.middleware')
const {
	getWorkerDashboard,
	getMyCompany,
	getWorkerBuildingNodesPage,
} = require('./dashboard.controller')

router.use(isAuth, isWorker)
// ============= My Company ========================== //
router.get('/company', getMyCompany)

//  ========================= Dashboard page routes ======================== //
router.get('/dashboard/buildings', getWorkerDashboard)

// //  ========================= Nodes page routes ======================== //
router.get('/buildings/:buildingId/nodes-page', getWorkerBuildingNodesPage)

module.exports = router
