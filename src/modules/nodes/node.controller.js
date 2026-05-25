const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')
const { handleNodeMqttMessage } = require('./door-node/node.mqtt.service')
const NodeService = require('./node.service')

const nodeService = new NodeService()

let nodeController = module.exports

nodeController.createNodes = async (req, res) => {
	try {
		const data = await nodeService.createNodes(req.body)
		return sendSuccess(res, {
			message: `${data.count} nodes created successfully`,
			data,
			statusCode: 201,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.getNodes = async (req, res) => {
	try {
		const data = await nodeService.getNodes()

		return sendSuccess(res, {
			message: 'Nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.getActiveNodes = async (req, res) => {
	try {
		const data = await nodeService.getActiveNodes()

		return sendSuccess(res, {
			message: 'Active nodes fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.nodeGraphicData = async (req, res) => {
	try {
		const data = await nodeService.nodeGraphicData(req.query)

		return sendSuccess(res, {
			message: 'Node graphic data fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.updateNode = async (req, res) => {
	try {
		const data = await nodeService.updateNode(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Node updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.bulkUpdateNodes = async (req, res) => {
	try {
		const data = await nodeService.bulkUpdateNodes(req.body)

		return sendSuccess(res, {
			message: 'Bulk update completed',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.updateNodeGateway = async (req, res) => {
	try {
		const data = await nodeService.updateNodeGateway(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Node gateway updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

nodeController.deleteNode = async (req, res) => {
	try {
		const data = await nodeService.deleteNode(req.params.id)

		return sendSuccess(res, {
			message: 'Node deleted successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}
