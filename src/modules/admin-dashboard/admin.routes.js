const express = require('express')
const {
	getAdminDashboard,
	getAssigningResources,
	getAdminOrganizationsTabs,
	getCompanyMembers,
	createCompanyMemberUser,
	getCompanyBuildings,
	getGateways,
	getNodes,
	getAvailableNodes,
	checkGateway,
	getGatewayNodes,
	checkNodes,
	registerNodesToGateway,
	updateCompanyMemberStatuses,
	updateCompanyBuildingStatuses,
} = require('./admin.controller')

const {
	getCompanies,
	getBuildings,
	getUsers,
	getOrganizationCompanyBuildings,
	getOrganizationBuildingGateways,
	getOrganizationUserCompanies,
} = require('./admin.organizations.controller')

const adminCompanyController = require('./admin.controller')
const adminAssignmentController = require('./admin.controller')

const router = express.Router()

// ====================== Admin dashboard page routes ================ //

router.get('/dashboard', getAdminDashboard)

// ------------ Company Members dialod button routes -----------------
router.get('/companies/:companyId/members', getCompanyMembers)
router.post('/companies/:companyId/members', createCompanyMemberUser)
router.patch(
	'/companies/:companyId/members/statuses',
	updateCompanyMemberStatuses,
)

// ------------ Company Buildings dialod button routes ---------------
router.get('/companies/:companyId/buildings', getCompanyBuildings)

router.patch(
	'/companies/:companyId/buildings/statuses',
	updateCompanyBuildingStatuses,
)

router.get('/organization-tabs', getAdminOrganizationsTabs)
router.get('/unassigned-resources', getAssigningResources)

// ---------------- Company Buildings page routes --------------------
router.get(
	'/buildings-page',
	adminCompanyController.getAdminCompanyBuildingsPage,
)
router.get(
	'/buildings-page/:buildingId/gateways',
	adminCompanyController.getAdminBuildingGateways,
)
router.put(
	'/buildings-page/:buildingId/gateways',
	adminCompanyController.updateAdminBuildingGateways,
)
router.get(
	'/buildings-page/:buildingId/workers',
	adminCompanyController.getAdminBuildingWorkers,
)
router.put(
	'/buildings-page/:buildingId/workers',
	adminCompanyController.updateAdminBuildingWorkers,
)
router.post(
	'/buildings-page/:buildingId/workers',
	adminCompanyController.createAdminBuildingWorker,
)
router.get(
	'/company/buildings/:buildingId/nodes-page',
	adminCompanyController.getAdminCompanyBuildingNodesPage,
)
router.patch(
	'/buildings/:buildingId/alarm-level',
	adminCompanyController.updateAlarmLevel,
)

// ================= Admin All Devices page routes ==================
router.get('/device/gateways', adminCompanyController.getAdminAllGateways)
router.get('/device/nodes', adminCompanyController.getAdminAllNodes)
router.get(
	'/device/gateways/:gatewayId/nodes',
	adminCompanyController.getAssignedNodesByGateway,
)

// ================= Admin Company Devices page routes ==================
router.get(
	'/devices/companies/:companyId/gateways',
	adminCompanyController.getCompanyGateways,
)
router.get(
	'/devices/companies/:companyId/nodes',
	adminCompanyController.getCompanyNodes,
)
router.get(
	'/devices/companies/:companyId/nodes/available',
	adminCompanyController.getCompanyAvailableNodes,
)

router.post(
	'/devices/companies/:companyId/nodes/check',
	adminCompanyController.checkCompanyAvailableNodes,
)
router.post(
	'/devices/companies/:companyId/gateways/:gatewayId/nodes/register',
	adminCompanyController.registerCompanyNodesToGateway,
)
router.post(
	'/devices/companies/:companyId/nodes/unassign',
	adminCompanyController.unassignCompanyNodes,
)
router.get(
	'/devices/companies/:companyId/gateways/:gatewayId/nodes',
	adminCompanyController.getCompanyAssignedNodesByGateway,
)

// =================== Admin Organization page tab routes ===========
router.get('/organization-page/companies', getCompanies)
router.get('/organization-page/buildings', getBuildings)
router.get('/organization-page/users', getUsers)

router.get(
	'/organization-page/companies/:companyId/buildings',
	getOrganizationCompanyBuildings,
)

router.get(
	'/organization-page/buildings/:buildingId/gateways',
	getOrganizationBuildingGateways,
)

router.get(
	'/organization-page/users/:userId/companies',
	getOrganizationUserCompanies,
)

// =============== Admin Company-Assignment page routes ===============
router.get(
	'/company-assignments',
	adminAssignmentController.getCompanyAssignments,
)

router.put(
	'/companies/:companyId/gateways',
	adminAssignmentController.updateCompanyGateways,
)

router.put(
	'/companies/:companyId/nodes',
	adminAssignmentController.updateCompanyNodes,
)

module.exports = router
