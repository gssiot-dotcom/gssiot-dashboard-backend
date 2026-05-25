const mongoose = require('mongoose')
const { getMqttClient } = require('../../infrastructure/mqtt')
const { eventBus } = require('../../shared/eventBus')
const { logger } = require('../../lib/logger')

const Gateway = require('./gateway.model')
const NodeSchema = require('../nodes/node.model')
const { NODE_TYPE } = require('../../lib/config')
const { BuildingSchema } = require('../building/building.model')

class GatewayService {
	constructor() {
		this.gatewaySchema = Gateway
		this.nodeSchema = NodeSchema
		this.buildingSchema = BuildingSchema
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	normalizeZoneName(value) {
		if (typeof value !== 'string') return null
		const trimmed = value.trim()
		return trimmed.length ? trimmed : null
	}

	buildGatewayTopic(serialNumber) {
		return `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${serialNumber}`
	}

	resolveNodeConfig(nodeType) {
		const key = String(nodeType || '')
			.trim()
			.toUpperCase()

		const configMap = {
			DOOR: {
				dbNodeType: NODE_TYPE.DOOR, // 'door_node'
				publishNodeType: 0,
			},
			ANGLE: {
				dbNodeType: NODE_TYPE.ANGLE, // 'angle_node'
				publishNodeType: 1,
			},
			GANGFORM: {
				dbNodeType: NODE_TYPE.GANGFORM, // 'gangform_node'
				publishNodeType: 2,
			},
		}

		const config = configMap[key]

		if (!config) {
			throw this.createError(
				'Invalid node_type. Allowed values: DOOR, ANGLE, GANGFORM',
				400,
			)
		}

		return {
			requestNodeType: key, // ANGLE
			dbNodeType: config.dbNodeType, // angle_node
			publishNodeType: config.publishNodeType,
			model: this.nodeSchema,
		}
	}

	async publishAsync(topic, payload) {
		logger('Publishing to MQTT:', { topic, payload })

		const mqttClient = getMqttClient()

		if (!mqttClient || !mqttClient.connected) {
			throw this.createError(
				'MQTT client is not connected (initMqtt called?)',
				500,
			)
		}

		return new Promise((resolve, reject) => {
			mqttClient.publish(topic, JSON.stringify(payload), err => {
				if (err) reject(err)
				else resolve(true)
			})
		})
	}

	waitForGatewayResponse({ gw_number, timeoutMs = 10000 }) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				cleanup()
				reject(this.createError('MQTT response timeout', 504))
			}, timeoutMs)

			const handler = payload => {
				logger('Received MQTT response:', payload)

				if (String(payload?.gw_number) !== String(gw_number)) return

				cleanup()

				if (payload?.data?.resp === 'success') {
					resolve(true)
				} else {
					reject(this.createError('Failed publishing for gateway to mqtt', 400))
				}
			}

			const cleanup = () => {
				clearTimeout(timer)
				eventBus.removeListener('gateway.response', handler)
			}

			eventBus.on('gateway.response', handler)
		})
	}

	async createGateway(payload = {}) {
		const serialNumber = payload.serialNumber?.trim()
		const gatewayType = payload.gatewayType
		const installedLocation = payload.installedLocation?.trim() || ''

		if (!serialNumber) {
			throw this.createError('serialNumber is required', 400)
		}

		if (!gatewayType) {
			throw this.createError('gatewayType is required', 400)
		}

		const existingGateway = await this.gatewaySchema.findOne({
			serialNumber: serialNumber,
		})

		if (existingGateway) {
			throw this.createError(
				`일련 번호가 ${existingGateway.serialNumber}인 기존 게이트웨이가 있습니다.`,
				409,
			)
		}

		const gateway = await this.gatewaySchema.create({
			...payload,
			serialNumber,
			installedLocation,
		})

		return gateway
	}

	async getGateways() {
		const gateways = await this.gatewaySchema.find()

		if (!gateways || gateways.length === 0) {
			throw this.createError('There is no any gateways in database :(', 404)
		}

		return gateways
	}

	async getActiveGateways() {
		const gateways = await this.gatewaySchema.find({ gateway_status: true })
		return gateways || []
	}

	async getGatewayDetail(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid gateway id', 400)
		}

		const gateway = await this.gatewaySchema.findById(id)

		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		return gateway
	}

	async updateGatewayStatus(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid gateway id', 400)
		}

		const gateway = await this.gatewaySchema.findOneAndUpdate(
			{ _id: id },
			[{ $set: { gateway_status: { $not: '$gateway_status' } } }],
			{ new: true },
		)

		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		return gateway
	}

	async updateGateway(id, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid gateway id', 400)
		}

		const allowedFields = [
			'gateway_type',
			'building_id',
			'installedLocation',
			'gateway_status',
			'gateway_alive',
		]

		const updateData = {}

		for (const field of allowedFields) {
			if (payload[field] !== undefined) {
				updateData[field] = payload[field]
			}
		}

		if (updateData.installedLocation !== undefined) {
			const normalizedInstalledLocation = this.normalizeInstalledLocation(
				updateData.installedLocation,
			)
			updateData.installedLocation = normalizedInstalledLocation || ''
		}

		if (Object.keys(updateData).length === 0) {
			throw this.createError('No valid fields provided for update', 400)
		}

		const updatedGateway = await this.gatewaySchema.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true },
		)

		if (!updatedGateway) {
			throw this.createError('Gateway not found', 404)
		}

		return updatedGateway
	}

	async connectNodesToGateway(gatewayId, payload = {}) {
		try {
			if (!mongoose.Types.ObjectId.isValid(gatewayId)) {
				throw this.createError('Invalid gateway id', 400)
			}

			const { nodeIds = [], nodeType } = payload

			if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
				throw this.createError('nodeIds array is required', 400)
			}

			if (!nodeType) {
				throw this.createError('nodeType is required', 400)
			}

			const gateway = await this.gatewaySchema.findById(gatewayId)

			if (!gateway) {
				throw this.createError(
					'Gateway not found, 먼저 게이트웨이를 생성하세요.',
					404,
				)
			}

			const config = this.resolveNodeConfig(nodeType)

			const foundNodes = await config.model
				.find(
					{
						_id: { $in: nodeIds },
						node_type: config.dbNodeType,
					},
					{
						_id: 1,
						node_number: 1,
						node_type: 1,
					},
				)
				.lean()

			if (foundNodes.length !== nodeIds.length) {
				const foundSet = new Set(foundNodes.map(node => String(node._id)))
				const missingOrWrongType = nodeIds.filter(
					id => !foundSet.has(String(id)),
				)

				throw this.createError(
					`Some nodes not found or nodeType is not ${config.nodeType}: ${missingOrWrongType.join(', ')}`,
					404,
				)
			}

			if (!foundNodes.length) {
				throw this.createError(
					'연결할 노드가 없습니다. nodeIds 배열을 확인하세요.',
					400,
				)
			}

			const gw_number = gateway.serialNumber
			const topic = this.buildGatewayTopic(gw_number)

			const publishData = {
				cmd: 2,
				nodeType: config.publishNodeType,
				numNodes: foundNodes.length,
				nodes: foundNodes.map(node => node.node_number),
			}

			logger('Connect nodes publish-data:', publishData, topic)

			const waitPromise = this.waitForGatewayResponse({
				gw_number,
				timeoutMs: 10000,
			})

			await this.publishAsync(topic, publishData)
			await waitPromise

			await config.model.updateMany(
				{
					_id: { $in: nodeIds },
					node_type: config.dbNodeType,
				},
				{
					$set: {
						node_status: false,
						gateway_id: gateway._id,
					},
				},
			)
			return {
				gateway_id: gateway._id,
				serialNumber: gateway.serialNumber,
				node_type: config.requestNodeType,
				db_node_type: config.dbNodeType,
				connected_count: foundNodes.length,
				node_ids: nodeIds,
			}
		} catch (error) {
			if (error.statusCode) throw error
			throw this.createError(
				`Error on connecting nodes to gateway: ${error.message}`,
				400,
			)
		}
	}

	async assignGatewayToBuilding(payload = {}) {
		const { gateway_ids, building_id } = payload

		if (!Array.isArray(gateway_ids) || gateway_ids.length === 0) {
			throw this.createError('gateway_ids must be a non-empty array', 400)
		}

		if (!building_id) {
			throw this.createError('building_id is required', 400)
		}

		if (!mongoose.Types.ObjectId.isValid(building_id)) {
			throw this.createError('Invalid building id', 400)
		}

		const invalidGatewayId = gateway_ids.find(
			id => !mongoose.Types.ObjectId.isValid(id),
		)

		if (invalidGatewayId) {
			throw this.createError(`Invalid gateway id: ${invalidGatewayId}`, 400)
		}

		const building = await this.buildingSchema.findById(building_id)

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		const gatewaysCount = await this.gatewaySchema.countDocuments({
			_id: { $in: gateway_ids },
		})

		if (gatewaysCount !== gateway_ids.length) {
			throw this.createError('Some gateways were not found', 404)
		}

		const updateData = {
			building_id,
		}

		await this.gatewaySchema.updateMany(
			{
				_id: { $in: gateway_ids },
			},
			{
				$set: updateData,
			},
		)

		const updatedGateways = await this.gatewaySchema.find({
			_id: { $in: gateway_ids },
		})

		return {
			assigned_count: updatedGateways.length,
			gateways: updatedGateways,
		}
	}

	async unassignGatewayFromBuilding(gatewayId) {
		if (!mongoose.Types.ObjectId.isValid(gatewayId)) {
			throw this.createError('Invalid gateway id', 400)
		}

		const gateway = await this.gatewaySchema.findById(gatewayId)
		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		const updatedGateway = await this.gatewaySchema.findByIdAndUpdate(
			gatewayId,
			{
				$set: {
					building_id: null,
				},
			},
			{ new: true },
		)

		return updatedGateway
	}

	async makeWakeUpOfficeGateway(payload = {}) {
		try {
			const serialNumber = payload.serialNumber
			const alarmActive = payload.alarmActive
			const alertLevel = payload.alertLevel

			if (!serialNumber) {
				throw this.createError('gw_number is required', 400)
			}

			const topic = this.buildGatewayTopic(serialNumber)

			const publishData = {
				cmd: 3,
				alarmActive,
				alertLevel,
			}

			logger('Publish-data:', publishData)

			await this.publishAsync(topic, publishData)

			return {
				topic,
				serialNumber,
				alarmActive,
				alertLevel,
			}
		} catch (error) {
			if (error.statusCode) throw error
			throw this.createError(`Error on wake-up gateway: ${error.message}`, 400)
		}
	}

	async deleteGateway(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid gateway id', 400)
		}

		const gateway = await this.gatewaySchema.findById(id)

		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		await this.nodeSchema.updateMany(
			{ gateway_id: gateway._id },
			{ $set: { node_status: true, gateway_id: null } },
		)

		const deletedGateway = await this.gatewaySchema.findByIdAndDelete(id)

		if (!deletedGateway) {
			throw this.createError('Gateway not found or already deleted', 404)
		}

		return deletedGateway
	}
}

module.exports = GatewayService
