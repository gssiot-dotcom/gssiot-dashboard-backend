const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logger, logError } = require('../../lib/logger')

const { getPaginationQuery } = require('../../utils/pagination')
const AdminCompanyAssignmentsService = require('./admin.assignment.service')
const AdminDashboardService = require('./admin.service')
const AdminCompanyBuildingsService = require('./admin.buildingspage.service')

const adminDashboardService = new AdminDashboardService()
const adminAssignmentService = new AdminCompanyAssignmentsService()
const adminCompanyBuildingsService = new AdminCompanyBuildingsService()

let adminDashboardController = module.exports
let adminAssignmentController = module.exports

adminDashboardController.getAdminDashboard = async (req, res) => {
	logger('Admin dashboard data requested', {
		query: req.query,
	})
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAdminDashboard({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Admin resources fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch admin resources',
			error.status || 500,
		)
	}
}

adminDashboardController.getCompanyMembers = async (req, res) => {
	try {
		const { companyId } = req.params
		const { memberRole, search = '' } = req.query

		const data = await adminDashboardService.getCompanyMembers({
			companyId,
			memberRole,
			search,
		})

		return sendSuccess(res, {
			message: 'Company members fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company members',
			error.status || 500,
		)
	}
}

adminDashboardController.createCompanyMemberUser = async (req, res) => {
	try {
		const { companyId } = req.params

		const data = await adminDashboardService.createCompanyMemberUser({
			companyId,
			payload: req.body,
		})

		return sendSuccess(res, {
			message: 'User created and assigned to company successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateCompanyMemberStatuses = async (req, res) => {
	try {
		const { companyId } = req.params
		const { activeMemberIds = [] } = req.body

		const data = await adminDashboardService.updateCompanyMemberStatuses({
			companyId,
			activeMemberIds,
		})

		return sendSuccess(res, {
			message: 'Company member statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company member statuses',
			error.status || 500,
		)
	}
}

adminDashboardController.getCompanyBuildings = async (req, res) => {
	try {
		const { companyId } = req.params
		const { memberRole, search = '' } = req.query

		const data = await adminDashboardService.getCompanyBuildings({
			companyId,
			memberRole,
			search,
		})

		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company buildings',
			error.status || 500,
		)
	}
}

adminDashboardController.createCompanyBuilding = async (req, res) => {
	try {
		const { companyId } = req.params

		const data = await adminDashboardService.createCompanyBuilding({
			companyId,
			payload: req.body,
		})

		return sendSuccess(res, {
			message: 'Building created and assigned to company successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateCompanyBuildingStatuses = async (req, res) => {
	try {
		const { companyId } = req.params
		const { activeBuildingIds = [] } = req.body

		const data = await adminDashboardService.updateCompanyBuildingStatuses({
			companyId,
			activeBuildingIds,
		})

		return sendSuccess(res, {
			message: 'Company building statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company building statuses',
			error.status || 500,
		)
	}
}

adminDashboardController.getAdminOrganizationsTabs = async (req, res) => {
	try {
		const { page, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAdminOrganizationsTabs({
			page,
			limit: 20,
			skip,
		})

		return sendSuccess(res, {
			message: 'Admin organizations tabs fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAssigningResources = async (req, res) => {
	try {
		const { page, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getAssigningResources({
			page,
			limit: 20,
			skip,
		})

		return sendSuccess(res, {
			message: 'Assigning resources fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch unassigned resources',
			error.status || 500,
		)
	}
}

// ========= Admin Company Devices page controllers ==========

adminDashboardController.getCompanyGateways = async (req, res) => {
	try {
		const data = await adminDashboardService.getCompanyGateways({
			companyId: req.params.companyId,
			search: req.query.search,
		})

		return sendSuccess(res, {
			message: 'Gateways fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getCompanyNodes = async (req, res) => {
	try {
		const data = await adminDashboardService.getCompanyNodes({
			companyId: req.params.companyId,
			search: req.query.search,
			nodeType: req.query.nodeType,
		})

		return sendSuccess(res, {
			message: 'Nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getCompanyAvailableNodes = async (req, res) => {
	try {
		const data = await adminDashboardService.getCompanyAvailableNodes({
			companyId: req.params.companyId,
			search: req.query.search,
			nodeType: req.query.nodeType,
		})

		return sendSuccess(res, {
			message: 'Available nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.checkCompanyAvailableNodes = async (req, res) => {
	try {
		const { nodeNumbers } = req.body

		const data = await adminDashboardService.checkCompanyAvailableNodes({
			companyId: req.params.companyId,
			nodeType: req.body.nodeType,
			numbers: req.body.numbers,
		})

		return sendSuccess(res, {
			message: 'Nodes checked successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.registerCompanyNodesToGateway = async (req, res) => {
	try {
		const data = await adminDashboardService.registerCompanyNodesToGatewayMqtt({
			companyId: req.params.companyId,
			gatewayId: req.params.gatewayId,
			nodeType: req.body.nodeType,
			numbers: req.body.numbers,
		})

		return sendSuccess(res, {
			message: 'Nodes registered to gateway successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.unassignCompanyNodes = async (req, res) => {
	try {
		const data = await adminDashboardService.unassignCompanyNodes({
			companyId: req.params.companyId,
			nodeIds: req.body.nodeIds,
		})
		return sendSuccess(res, {
			message: 'Nodes unassigned successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getCompanyAssignedNodesByGateway = async (
	req,
	res,
) => {
	try {
		const data = await adminDashboardService.getCompanyAssignedNodesByGateway({
			companyId: req.params.companyId,
			gatewayId: req.params.gatewayId,
		})

		return sendSuccess(res, {
			message: 'Gateway nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getCompanies = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getCompanies({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Companies fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch companies',
			error.statusCode || error.status || 500,
		)
	}
}

adminDashboardController.getBuildings = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getBuildings({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch buildings',
			error.statusCode || error.status || 500,
		)
	}
}

adminDashboardController.getUsers = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminDashboardService.getUsers({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Users fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch users',
			error.statusCode || error.status || 500,
		)
	}
}

adminDashboardController.getOrganizationCompanyBuildings = async (req, res) => {
	try {
		const data = await adminDashboardService.getCompanyBuildings(
			req.params.companyId,
		)

		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company buildings',
			error.statusCode || error.status || 500,
		)
	}
}

adminDashboardController.getOrganizationBuildingGateways = async (req, res) => {
	try {
		const data = await adminDashboardService.getBuildingGateways(
			req.params.buildingId,
		)

		return sendSuccess(res, {
			message: 'Building gateways fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch building gateways',
			error.statusCode || error.status || 500,
		)
	}
}

adminDashboardController.getOrganizationUserCompanies = async (req, res) => {
	try {
		const data = await adminDashboardService.getUserCompanies(req.params.userId)

		return sendSuccess(res, {
			message: 'User companies fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch user companies',
			error.statusCode || error.status || 500,
		)
	}
}

//  ======================= Admin Company-Assignments page controllers ==================
adminAssignmentController.getCompanyAssignments = async (req, res) => {
	try {
		const data = await adminAssignmentService.getCompanyAssignments({
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Company assignments fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company assignments',
			error.status || 500,
		)
	}
}

adminAssignmentController.updateCompanyGateways = async (req, res) => {
	try {
		const data = await adminAssignmentService.updateCompanyGateways({
			companyId: req.params.companyId,
			gatewayIds: req.body.gatewayIds || [],
		})

		return sendSuccess(res, {
			message: 'Company gateways updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company gateways',
			error.status || 500,
		)
	}
}

adminAssignmentController.updateCompanyNodes = async (req, res) => {
	try {
		const data = await adminAssignmentService.updateCompanyNodes({
			companyId: req.params.companyId,
			nodeIds: req.body.nodeIds || [],
		})

		return sendSuccess(res, {
			message: 'Company nodes updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to update company nodes',
			error.status || 500,
		)
	}
}

//  ======================= Admin Company Buildings page controllers ==================

adminDashboardController.getAdminCompanyBuildingsPage = async (req, res) => {
	try {
		const data =
			await adminCompanyBuildingsService.getAdminCompanyBuildingsPage({
				companyId: req.query.companyId,
			})

		return sendSuccess(res, {
			message: 'Company Buildings page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAdminBuildingGateways = async (req, res, next) => {
	try {
		const { buildingId } = req.params

		const data =
			await adminCompanyBuildingsService.getAdminBuildingGatewaysDialog({
				buildingId,
			})

		return sendSuccess(res, {
			message: 'Building gateways called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateAdminBuildingGateways = async (
	req,
	res,
	next,
) => {
	try {
		const { buildingId } = req.params
		const { gatewayIds = [] } = req.body

		const data =
			await adminCompanyBuildingsService.updateAdminBuildingGatewaysDialog({
				buildingId,
				gatewayIds,
			})

		return sendSuccess(res, {
			message: 'Company Buildings page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAdminBuildingWorkers = async (req, res, next) => {
	try {
		const { buildingId } = req.params

		const data =
			await adminCompanyBuildingsService.getAdminBuildingWorkersDialog({
				buildingId,
			})

		return sendSuccess(res, {
			message: 'Company Buildings page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateAdminBuildingWorkers = async (
	req,
	res,
	next,
) => {
	try {
		const { buildingId } = req.params
		const { workerIds = [] } = req.body

		const data = await adminCompanyBuildingsService.updateAdminBuildingWorkers({
			buildingId,
			workerIds,
		})

		return sendSuccess(res, {
			message: 'Company Buildings page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.createAdminBuildingWorker = async (req, res, next) => {
	try {
		const { buildingId } = req.params

		const data = await adminCompanyBuildingsService.createAdminBuildingWorker({
			buildingId,
			payload: req.body,
		})

		return sendSuccess(res, {
			message: 'Company Buildings page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAdminCompanyBuildingNodesPage = async (
	req,
	res,
) => {
	try {
		const data =
			await adminCompanyBuildingsService.getAdminCompanyBuildingNodesPage({
				companyId: req.query.companyId,
				buildingId: req.params.buildingId,
				nodeType: req.query.nodeType,
			})

		return sendSuccess(res, {
			message: 'Company Building Nodes page called successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.updateAlarmLevel = async (req, res, next) => {
	try {
		const { buildingId } = req.params
		const { alarmType, green, yellow, red } = req.body

		const alarmLevel =
			await adminCompanyBuildingsService.updateBuildingAlarmLevel({
				buildingId,
				alarmType,
				green,
				yellow,
				red,
			})

		return sendSuccess(res, {
			message: 'Company Building Nodes page called successfully',
			data: alarmLevel,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

// ========= Admin All Devices page controllers ==========
adminDashboardController.getAdminAllGateways = async (req, res) => {
	try {
		const data = await adminDashboardService.getAdminAllGateways({
			search: req.query.search,
		})

		return sendSuccess(res, {
			message: 'Gateways fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAdminAllNodes = async (req, res) => {
	try {
		const data = await adminDashboardService.getAdminAllNodes({
			search: req.query.search,
			nodeType: req.query.nodeType,
		})

		return sendSuccess(res, {
			message: 'Nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

adminDashboardController.getAssignedNodesByGateway = async (req, res) => {
	try {
		const data = await adminDashboardService.getAssignedNodesByGateway({
			gatewayId: req.params.gatewayId,
		})

		return sendSuccess(res, {
			message: 'Gateway nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}
