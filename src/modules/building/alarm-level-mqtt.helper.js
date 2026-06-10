const { getMqttClient } = require('../../infrastructure/mqtt')
const { eventBus } = require('../../shared/eventBus')
const { logger } = require('../../lib/logger')
const { NODE_TYPE } = require('../../lib/config')

const ALARM_LEVEL_SET_CMD = 4
const FAULT_FILTER_SET_CMD = 5
const MQTT_TIMEOUT_MS = 10000
const GATEWAY_SERIAL_PREFIX = 'GRM22JU22P'

function createError(message, statusCode = 400) {
	const error = new Error(message)
	error.statusCode = statusCode
	return error
}

function getGatewayTopicSerial(serialNumber) {
	const value = String(serialNumber || '').trim()

	if (!value) {
		throw createError('Gateway serialNumber is required', 400)
	}

	return value.startsWith(GATEWAY_SERIAL_PREFIX)
		? value
		: `${GATEWAY_SERIAL_PREFIX}${value}`
}

function getGatewayResponseId(serialNumber) {
	return String(serialNumber || '')
		.trim()
		.slice(-4)
}

function buildGatewayTopic(serialNumber) {
	return `GSSIOT/01030369081/GATE_SUB/${getGatewayTopicSerial(serialNumber)}`
}

function resolveAlarmNodeType(alarmType) {
	const nodeTypeMap = {
		[NODE_TYPE.ANGLE]: 1,
		[NODE_TYPE.GANGFORM]: 2,
	}

	const nodeType = nodeTypeMap[alarmType]

	if (typeof nodeType !== 'number') {
		throw createError('Invalid alarm type', 400)
	}

	return nodeType
}

function normalizeNodeNumbers(nodes) {
	if (!Array.isArray(nodes)) {
		throw createError('nodes must be an array', 400)
	}

	const normalized = nodes.map(Number)

	if (
		normalized.some(
			nodeNumber =>
				!Number.isInteger(nodeNumber) || nodeNumber < 1 || nodeNumber > 9999,
		)
	) {
		throw createError('nodes must contain valid node numbers', 400)
	}

	return [...new Set(normalized)].sort((a, b) => a - b)
}

function isSuccessResponse(data) {
	return (
		data?.resp === 'success' ||
		data?.status === 'success' ||
		data?.result === 'success' ||
		data?.success === true ||
		data?.ok === true
	)
}

async function publishAsync(topic, payload) {
	logger('Publishing gateway command to MQTT:', { topic, payload })

	const mqttClient = getMqttClient()

	if (!mqttClient || !mqttClient.connected) {
		throw createError('MQTT client is not connected (initMqtt called?)', 500)
	}

	return new Promise((resolve, reject) => {
		mqttClient.publish(topic, JSON.stringify(payload), err => {
			if (err) {
				reject(err)
				return
			}

			resolve(true)
		})
	})
}

function waitForGatewayCommandResponse({
	serialNumber,
	cmd = ALARM_LEVEL_SET_CMD,
	timeoutMs = MQTT_TIMEOUT_MS,
}) {
	const responseId = getGatewayResponseId(serialNumber)

	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup()
			reject(createError('MQTT response timeout', 504))
		}, timeoutMs)

		const handler = payload => {
			if (String(payload?.gw_number) !== responseId) return

			const data = payload?.data || {}
			if (Number(data?.cmd) !== cmd) return

			logger('Received gateway command MQTT response:', {
				gw_number: payload.gw_number,
				data,
			})

			cleanup()

			if (isSuccessResponse(data)) {
				resolve(data)
				return
			}

			reject(createError('Failed setting alarm level on gateway', 400))
		}

		const cleanup = () => {
			clearTimeout(timer)
			eventBus.removeListener('gateway.response', handler)
		}

		eventBus.on('gateway.response', handler)
	})
}

async function sendAlarmLevelToGateways({
	gateways,
	alarmType,
	green,
	yellow,
	red,
	enabled = true,
	timeoutMs = MQTT_TIMEOUT_MS,
}) {
	if (!Array.isArray(gateways) || gateways.length === 0) {
		throw createError('No assigned gateways found for this building', 404)
	}

	const nodeType = resolveAlarmNodeType(alarmType)
	const payload = enabled
		? {
				cmd: ALARM_LEVEL_SET_CMD,
				nodeType,
				enabled: true,
				alarmEnabled: true,
				alarmLevel1: green,
				alarmLevel2: yellow,
				alarmLevel3: red,
			}
		: {
				cmd: ALARM_LEVEL_SET_CMD,
				nodeType,
				enabled: false,
				alarmEnabled: false,
			}

	const results = await Promise.all(
		gateways.map(async gateway => {
			const gatewayId =
				gateway._id?.toString() || gateway.id?.toString() || null
			const gatewaySerialNum = gateway.serialNumber
			const topic = buildGatewayTopic(gatewaySerialNum)
			const waitPromise = waitForGatewayCommandResponse({
				serialNumber: gatewaySerialNum,
				cmd: ALARM_LEVEL_SET_CMD,
				timeoutMs,
			})

			try {
				await publishAsync(topic, payload)
				const response = await waitPromise

				return {
					gatewayId,
					gatewaySerialNum,
					status: 'success',
					message: 'success',
					response,
				}
			} catch (error) {
				waitPromise.catch(() => {})

				return {
					gatewayId,
					gatewaySerialNum,
					status: error?.statusCode === 504 ? 'timeout' : 'error',
					message: error?.message || 'Failed setting alarm level on gateway',
				}
			}
		}),
	)

	const summary = results.reduce(
		(acc, result) => {
			acc.total += 1
			acc[`${result.status}Count`] += 1
			return acc
		},
		{
			total: 0,
			successCount: 0,
			errorCount: 0,
			timeoutCount: 0,
		},
	)

	return {
		cmd: ALARM_LEVEL_SET_CMD,
		payload,
		results,
		summary,
	}
}

async function sendFaultFilterToGateway({
	gateway,
	alarmType,
	nodes,
	timeoutMs = MQTT_TIMEOUT_MS,
}) {
	if (!gateway) {
		throw createError('Gateway is required', 404)
	}

	const gatewayId = gateway._id?.toString() || gateway.id?.toString() || null
	const gatewaySerialNum = gateway.serialNumber
	const topic = buildGatewayTopic(gatewaySerialNum)
	const nodeType = resolveAlarmNodeType(alarmType)
	const faultFilterNodes = normalizeNodeNumbers(nodes)
	const payload = {
		cmd: FAULT_FILTER_SET_CMD,
		nodeType,
		numNodes: faultFilterNodes.length,
		nodes: faultFilterNodes,
	}
	const waitPromise = waitForGatewayCommandResponse({
		serialNumber: gatewaySerialNum,
		cmd: FAULT_FILTER_SET_CMD,
		timeoutMs,
	})

	try {
		await publishAsync(topic, payload)
		const response = await waitPromise

		const result = {
			gatewayId,
			gatewaySerialNum,
			status: 'success',
			message: 'success',
			response,
		}

		return {
			cmd: FAULT_FILTER_SET_CMD,
			payload,
			results: [result],
			summary: {
				total: 1,
				successCount: 1,
				errorCount: 0,
				timeoutCount: 0,
			},
		}
	} catch (error) {
		waitPromise.catch(() => {})

		const result = {
			gatewayId,
			gatewaySerialNum,
			status: error?.statusCode === 504 ? 'timeout' : 'error',
			message: error?.message || 'Failed setting fault filter on gateway',
		}

		return {
			cmd: FAULT_FILTER_SET_CMD,
			payload,
			results: [result],
			summary: {
				total: 1,
				successCount: 0,
				errorCount: result.status === 'error' ? 1 : 0,
				timeoutCount: result.status === 'timeout' ? 1 : 0,
			},
		}
	}
}

module.exports = {
	sendAlarmLevelToGateways,
	sendFaultFilterToGateway,
}
