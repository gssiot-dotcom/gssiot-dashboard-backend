const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logger, logError } = require('../../lib/logger')
const {
	saveAssetToDb,
	removeAssetFromDb,
	deleteObjectFromS3,
	createPresignedPutUrl,
} = require('../assets/asset.service')
const ManagerDashboardService = require('./dashboard.service')

const managerDashboardService = new ManagerDashboardService()

let managerDashboardController = module.exports

managerDashboardController.getMyCompany = async (req, res) => {
	try {
		const data = await managerDashboardService.getMyCompany({
			userId: req.user._id,
		})

		return sendSuccess(res, {
			message: 'Manager dashboard data fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.getManagerDashboard = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerDashboard({
			userId: req.user._id,
		})

		return sendSuccess(res, {
			message: 'Manager dashboard data fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.getManagerCompanyMembers = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerCompanyMembers({
			userId: req.user._id,
			memberRole: req.query.memberRole,
			search: req.query.search || '',
		})
		return sendSuccess(res, {
			message: 'Company members fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.createManagerCompanyMemberUser = async (
	req,
	res,
) => {
	try {
		const data = await managerDashboardService.createManagerCompanyMemberUser({
			userId: req.user._id,
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

managerDashboardController.updateManagerCompanyMemberStatuses = async (
	req,
	res,
) => {
	try {
		const data =
			await managerDashboardService.updateManagerCompanyMemberStatuses({
				userId: req.user._id,
				activeMemberIds: req.body.activeMemberIds || [],
			})
		return sendSuccess(res, {
			message: 'Company member statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.getManagerCompanyBuildings = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerCompanyBuildings({
			userId: req.user._id,
			search: req.query.search || '',
		})
		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.createManagerBuilding = async (req, res) => {
	try {
		const data = await managerDashboardService.createManagerBuilding({
			userId: req.user._id,
			payload: req.body,
		})
		return sendSuccess(res, {
			message: 'Building created successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.updateManagerCompanyBuildingStatuses = async (
	req,
	res,
) => {
	try {
		const data =
			await managerDashboardService.updateManagerCompanyBuildingStatuses({
				userId: req.user._id,
				activeBuildingIds: req.body.activeBuildingIds || [],
			})
		return sendSuccess(res, {
			message: 'Company building statuses updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

// ========================== Buildings page controllers =================== //
managerDashboardController.getManagerCompanyBuildingsPage = async (
	req,
	res,
) => {
	try {
		const data = await managerDashboardService.getManagerCompanyBuildingsPage({
			userId: req.user._id,
		})

		return sendSuccess(res, {
			message: 'Manager company buildings page fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.getManagerBuildingGateways = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerBuildingGateways({
			userId: req.user._id,
			buildingId: req.params.buildingId,
		})
		return sendSuccess(res, {
			message: 'Building gateways fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.updateManagerBuildingGateways = async (req, res) => {
	try {
		const data = await managerDashboardService.updateManagerBuildingGateways({
			userId: req.user._id,
			buildingId: req.params.buildingId,
			gatewayIds: req.body.gatewayIds || [],
		})
		return sendSuccess(res, {
			message: 'Building gateways updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.getManagerBuildingWorkers = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerBuildingWorkers({
			userId: req.user._id,
			buildingId: req.params.buildingId,
		})
		return sendSuccess(res, {
			message: 'Building workers fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.updateManagerBuildingWorkers = async (req, res) => {
	try {
		const data = await managerDashboardService.updateManagerBuildingWorkers({
			userId: req.user._id,
			buildingId: req.params.buildingId,
			workerIds: req.body.workerIds || [],
		})
		return sendSuccess(res, {
			message: 'Building workers updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.createManagerBuildingWorker = async (req, res) => {
	try {
		const data = await managerDashboardService.createManagerBuildingWorker({
			userId: req.user._id,
			buildingId: req.params.buildingId,
			payload: req.body,
		})
		return sendSuccess(res, {
			message: 'Building worker created successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

//  ========================= Nodes page controllers ======================== //
managerDashboardController.getManagerBuildingNodesPage = async (req, res) => {
	try {
		const data = await managerDashboardService.getManagerBuildingNodesPage({
			userId: req.user._id,
			buildingId: req.params.buildingId,
			nodeType: req.query.nodeType,
		})
		return sendSuccess(res, {
			message: 'Building nodes page fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.updateAlarmLevel = async (req, res, next) => {
	try {
		const { buildingId } = req.params
		const { alarmType, green, yellow, red } = req.body

		const alarmLevel = await managerDashboardService.updateBuildingAlarmLevel({
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

// ================= Manager uploading images on AWS controller =============== //
managerDashboardController.getManagerPresignedUrl = async (req, res) => {
	try {
		const { kind, buildingId, fileName, contentType, companyId } = req.body

		const membership =
			await managerDashboardService.getAuthorizedManagerMembership({
				userId: req.user._id,
				companyId,
			})

		const data = await createPresignedPutUrl({
			kind,
			companyId: membership.companyId,
			buildingId,
			fileName,
			contentType,
		})

		return sendSuccess(res, {
			message: 'Presigned URL created successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.saveManagerAsset = async (req, res) => {
	try {
		const { kind, buildingId, key, companyId } = req.body

		const membership =
			await managerDashboardService.getAuthorizedManagerMembership({
				userId: req.user._id,
				companyId,
			})

		const data = await saveAssetToDb({
			kind,
			companyId: membership.companyId,
			buildingId,
			key,
		})

		return sendSuccess(res, {
			message: 'Asset saved successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

managerDashboardController.removeManagerAsset = async (req, res) => {
	try {
		const { kind, buildingId, key, companyId } = req.body

		const membership =
			await managerDashboardService.getAuthorizedManagerMembership({
				userId: req.user._id,
				companyId,
			})

		await removeAssetFromDb({
			kind,
			companyId: membership.companyId,
			buildingId,
			key,
		})

		await deleteObjectFromS3(key)

		return sendSuccess(res, {
			message: 'Asset removed successfully',
			data: { deleted: true },
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}
