const WorkerDashboardService = require('./dashboard.service')
const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')

const workerDashboardService = new WorkerDashboardService()

let workerDashboardController = module.exports

workerDashboardController.getMyCompany = async (req, res, next) => {
	try {
		logger('request: worker-MyCompany')

		const result = await workerDashboardService.getMyCompany(req.user._id)

		return sendSuccess(res, {
			message: 'Worker company fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.getMyCompany: company', error)
		return sendFail(res, error)
	}
}

workerDashboardController.getWorkerDashboard = async (req, res, next) => {
	try {
		logger('request: worker-dashboard-assignedBuildings')

		const result = await workerDashboardService.getWorkerDashboardPage(
			req.user._id,
		)

		return sendSuccess(res, {
			message: 'Assigned buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.WorkerDashboard: assignedBuildings', error)
		return sendFail(res, error)
	}
}

workerDashboardController.getWorkerBuildingNodesPage = async (req, res) => {
	try {
		const data = await workerDashboardService.getWorkerBuildingNodesPage({
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
