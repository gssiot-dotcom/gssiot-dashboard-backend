const { createMqttClient } = require('./client')
const { topics } = require('./topics')
const { logError, logger } = require('../../lib/logger')

const {
	handleNodeMqttMessage,
} = require('../../modules/nodes/door-node/node.mqtt.service')
const {
	handleAngleNodeMqttMessage,
} = require('../../modules/nodes/angle-node/angleNode.mqtt.service')
// const { ConcurrencyQueue } = require('../../utils/ConcurrencyQueue')
const {
	handleVerticalNodeMqttMessage,
} = require('../../modules/nodes/vertical-node/vertical.node.service')

// export qilish kerak bo‘lsa:
let mqttClient

function safeJsonParse(buf) {
	try {
		return JSON.parse(buf.toString())
	} catch {
		return null
	}
}

function getGatewayLast4FromTopic(topic) {
	const last = topic.split('/').pop()
	return last ? last.slice(-4) : null
}

function initMqtt() {
	mqttClient = createMqttClient()

	// MQTT message processing concurrency limit (eng muhim fix)

	mqttClient.on('connect', () => {
		topics.all.forEach(t => {
			mqttClient.subscribe(t, err => {
				if (!err) logger('Subscribed to:', t)
				else logError('Error subscribing:', err)
			})
		})
	})

	mqttClient.on('message', (topic, buf) => {
		logger('data:', topic, buf.toString())

		const data = safeJsonParse(buf)
		if (!data) {
			logError('MQTT JSON parse error')
			return
		}

		const gatewayNumberLast4 = getGatewayLast4FromTopic(topic)
		if (!gatewayNumberLast4) return
		;(async () => {
			try {
				if (topic.startsWith(topics.nodePrefix)) {
					await handleNodeMqttMessage({ topic, data, gatewayNumberLast4 })
					return
				}

				if (topic.startsWith(topics.anglePrefix)) {
					await handleAngleNodeMqttMessage({
						topic,
						data,
						gatewayNumberLast4,
					})
					return
				}

				if (topic.startsWith(topics.formPrefix)) {
					await handleVerticalNodeMqttMessage({ data, gatewayNumberLast4 })
					return
				}

				if (topic.startsWith(topics.gwResPrefix)) {
					const { eventBus } = require('../../shared/eventBus')

					logger('EMIT gateway.response', {
						gw_number: gatewayNumberLast4,
						data,
					})

					eventBus.emit('gateway.response', {
						gw_number: gatewayNumberLast4,
						data,
					})
					return
				}
			} catch (err) {
				logError('MQTT dispatch error:', err?.message || err)
			}
		})()
	})

	if (process.env.DOOR_NODE_SIMULATOR === 'true') {
		startDoorNodeMqttSimulator()
	}

	return mqttClient
}

module.exports = { initMqtt, getMqttClient: () => mqttClient }

// =================================== MQTT door-node testing function ======================== //

let doorNodeSimulatorTimer = null
let doorNodeSimulatorRunning = false

function shuffleArray(array) {
	return [...array].sort(() => Math.random() - 0.5)
}

function getRandomDoorChk() {
	return Math.random() > 0.5 ? 1 : 0
}

function getRandomBatteryLevel() {
	return Math.floor(Math.random() * 41) + 60 // 60 ~ 100
}

async function startDoorNodeMqttSimulator() {
	if (process.env.NODE_ENV === 'production') {
		logger('Door node simulator disabled in production')
		return
	}

	if (doorNodeSimulatorTimer) {
		logger('Door node simulator already running')
		return
	}

	const gatewayNumberLast4 = '0201'
	const nodeNumbers = [100, 101, 102, 103, 104, 105]
	const intervalMs = 10_000

	const tick = async () => {
		if (doorNodeSimulatorRunning) {
			logger('Door node simulator skipped: previous tick still running')
			return
		}

		doorNodeSimulatorRunning = true

		try {
			const shuffledNodes = shuffleArray(nodeNumbers)

			logger('Door node simulator tick:', {
				gatewayNumberLast4,
				nodes: shuffledNodes,
			})

			for (const doorNum of shuffledNodes) {
				const doorChk = getRandomDoorChk()

				const data = {
					doorNum,
					doorChk, // 0 = normal, 1 = danger
					betChk: getRandomBatteryLevel(),
				}

				logger('Fake Door-Node MQTT:', {
					gatewayNumberLast4,
					data,
				})

				await handleNodeMqttMessage({
					data,
					gatewayNumberLast4,
				})
			}
		} catch (err) {
			logError('Door node simulator error:', err?.message || err)
		} finally {
			doorNodeSimulatorRunning = false
		}
	}

	// Server ishga tushganda darhol bir marta yuboradi
	await tick()

	// Keyin har 10 sekundda yuboradi
	doorNodeSimulatorTimer = setInterval(tick, intervalMs)

	logger('Door node simulator started:', {
		gatewayNumberLast4,
		nodeNumbers,
		intervalMs,
	})
}

function stopDoorNodeMqttSimulator() {
	if (!doorNodeSimulatorTimer) return

	clearInterval(doorNodeSimulatorTimer)
	doorNodeSimulatorTimer = null
	doorNodeSimulatorRunning = false

	logger('Door node simulator stopped')
}
