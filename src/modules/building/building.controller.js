const BuildingService = require('./building.service')
const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')

const buildingService = new BuildingService()

let buildingController = module.exports

buildingController.createBuilding = async (req, res, next) => {
	try {
		logger('request: building-create')

		const result = await buildingService.createBuilding(req.body)

		return sendSuccess(res, {
			message: 'Building created successfully',
			data: result,
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.buildings = async (req, res, next) => {
	try {
		logger('request: building-buildings')

		const result = await buildingService.getBuildings(req.query)

		return sendSuccess(res, {
			message: 'Buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.activeBuildings = async (req, res, next) => {
	try {
		logger('request: building-activeBuildings')

		const result = await buildingService.getActiveBuildings(req.query)

		return sendSuccess(res, {
			message: 'Active buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.detail = async (req, res, next) => {
	try {
		logger('request: building-detail')

		const result = await buildingService.getBuildingDetail(req.params.id)

		return sendSuccess(res, {
			message: 'Building detail fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.updateStatus = async (req, res, next) => {
	try {
		logger('request: building-updateStatus')

		const result = await buildingService.updateBuildingStatus(req.params.id)

		return sendSuccess(res, {
			message: 'Building status updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.update = async (req, res, next) => {
	try {
		logger('request: building-update')

		const result = await buildingService.updateBuilding(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Building updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.updateAlarmLevels = async (req, res, next) => {
	try {
		logger('request: building-updateAlarmLevels')

		const result = await buildingService.updateAlarmLevels(
			req.params.id,
			req.body,
		)

		return sendSuccess(res, {
			message: 'Building alarm levels updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.workers = async (req, res, next) => {
	try {
		logger('request: building-workers')

		const result = await buildingService.getBuildingWorkers(req.params.id)

		return sendSuccess(res, {
			message: 'Building workers fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

buildingController.deleteBuilding = async (req, res, next) => {
	try {
		logger('request: building-deleteBuilding')

		const result = await buildingService.deleteBuilding(req.params.id)

		return sendSuccess(res, {
			message: 'Building deleted successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}
