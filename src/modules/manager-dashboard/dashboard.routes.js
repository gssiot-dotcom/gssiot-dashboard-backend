const router = require('express').Router()

const { isAuth } = require('../../middlewares/auth.middleware')
const { isManager } = require('../../middlewares/role.middleware')
const {
	getManagerDashboard,
	getManagerCompanyBuildingsPage,
	getManagerCompanyMembers,
	createManagerCompanyMemberUser,
	updateManagerCompanyMemberStatuses,
	getManagerCompanyBuildings,
	createManagerBuilding,
	updateManagerCompanyBuildingStatuses,
	getManagerBuildingNodesPage,
	createManagerBuildingWorker,
	getManagerBuildingWorkers,
	updateManagerBuildingGateways,
	getManagerBuildingGateways,
	getManagerPresignedUrl,
	saveManagerAsset,
	removeManagerAsset,
	updateManagerBuildingWorkers,
	getMyCompany,
	updateAlarmLevel,
} = require('./dashboard.controller')

router.use(isAuth, isManager)
// ============= My Company ========================== //
router.get('/company/me', getMyCompany)

//  ========================= Dashboard page routes ======================== //
router.get('/dashboard', getManagerDashboard)
router.get('/members', getManagerCompanyMembers)
router.post('/members', createManagerCompanyMemberUser)
router.patch('/members/statuses', updateManagerCompanyMemberStatuses)
router.get('/buildings', getManagerCompanyBuildings)
router.post('/buildings', createManagerBuilding)
router.patch('/buildings/statuses', updateManagerCompanyBuildingStatuses)

//  ========================= Buildings page routes ======================== //
router.get('/buildings-page', getManagerCompanyBuildingsPage)
router.get('/buildings/:buildingId/gateways', getManagerBuildingGateways)
router.put('/buildings/:buildingId/gateways', updateManagerBuildingGateways)
router.get('/buildings/:buildingId/workers', getManagerBuildingWorkers)
router.put('/buildings/:buildingId/workers', updateManagerBuildingWorkers)
router.post('/buildings/:buildingId/workers', createManagerBuildingWorker)

//  ========================= Nodes page routes ======================== //
router.get('/buildings/:buildingId/nodes-page', getManagerBuildingNodesPage)
router.patch('/buildings/:buildingId/alarm-level', updateAlarmLevel)

// ========================= Manager uploading images on AWS routes ===================== //
router.post('/assets/presigned-url', getManagerPresignedUrl)
router.post('/assets/save', saveManagerAsset)
router.post('/assets/remove', removeManagerAsset)

module.exports = router
