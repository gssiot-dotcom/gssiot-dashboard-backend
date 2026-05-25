const GatewayService = require('./gateway.service')
const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')

const gatewayService = new GatewayService()

let gatewayController = module.exports

gatewayController.createGateway = async (req, res, next) => {
	try {
		logger('request: gateway-create')

		const result = await gatewayService.createGateway(req.body)

		return sendSuccess(res, {
			message: 'Gateway created successfully',
			data: result,
			statusCode: 201,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: createGateway', error)
		return sendFail(res, error)
	}
}

gatewayController.gateways = async (req, res, next) => {
	try {
		logger('request: gateway-gateways')

		const result = await gatewayService.getGateways()

		return sendSuccess(res, {
			message: 'Gateways fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: gateways', error)
		return sendFail(res, error)
	}
}

gatewayController.activeGateways = async (req, res, next) => {
	try {
		logger('request: gateway-activeGateways')

		const result = await gatewayService.getActiveGateways()

		return sendSuccess(res, {
			message: 'Active gateways fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: activeGateways', error)
		return sendFail(res, error)
	}
}

gatewayController.detail = async (req, res, next) => {
	try {
		logger('request: gateway-detail')

		const result = await gatewayService.getGatewayDetail(req.params.id)

		return sendSuccess(res, {
			message: 'Gateway detail fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: detail', error)
		return sendFail(res, error)
	}
}

gatewayController.updateStatus = async (req, res, next) => {
	try {
		logger('request: gateway-updateStatus')

		const result = await gatewayService.updateGatewayStatus(req.params.id)

		return sendSuccess(res, {
			message: 'Gateway status updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: updateStatus', error)
		return sendFail(res, error)
	}
}

gatewayController.update = async (req, res, next) => {
	try {
		logger('request: gateway-update')

		const result = await gatewayService.updateGateway(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Gateway updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: update', error)
		return sendFail(res, error)
	}
}

gatewayController.connectNodesToGateway = async (req, res, next) => {
	try {
		logger('request: gateway-connectNodesToGateway')

		const result = await gatewayService.connectNodesToGateway(
			req.params.id,
			req.body,
		)

		return sendSuccess(res, {
			message: 'Nodes connected to gateway successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: connectNodesToGateway', error)
		return sendFail(res, error)
	}
}

gatewayController.assignBuilding = async (req, res, next) => {
	try {
		logger('request: gateway-assignBuilding')

		const result = await gatewayService.assignGatewayToBuilding(req.body)

		return sendSuccess(res, {
			message: 'Gateways assigned to building successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

gatewayController.unassignBuilding = async (req, res, next) => {
	try {
		logger('request: gateway-unassignBuilding')

		const result = await gatewayService.unassignGatewayFromBuilding(
			req.params.id,
		)

		return sendSuccess(res, {
			message: 'Gateway unassigned from building successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

gatewayController.makeWakeUpOfficeGateway = async (req, res, next) => {
	try {
		logger('request: gateway-makeWakeUpOfficeGateway')

		const result = await gatewayService.makeWakeUpOfficeGateway(req.body)

		return sendSuccess(res, {
			message: 'Wake up office gateway command sent successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: makeWakeUpOfficeGateway', error)
		return sendFail(res, error)
	}
}

gatewayController.deleteGateway = async (req, res, next) => {
	try {
		logger('request: gateway-deleteGateway')

		const result = await gatewayService.deleteGateway(req.params.id)

		return sendSuccess(res, {
			message: 'Gateway deleted successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Gateway: deleteGateway', error)
		return sendFail(res, error)
	}
}
