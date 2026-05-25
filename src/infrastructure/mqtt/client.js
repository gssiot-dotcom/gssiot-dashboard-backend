const mqtt = require('mqtt')
const { logError, logger } = require('../../lib/logger') // sizda bor

function createMqttClient() {
	const client = mqtt.connect('mqtt://gssiot.iptime.org:10200', {
		username: '01030369081',
		password: 'qwer1234',
	})

	client.on('error', err => {
		logError('MQTT connection error:', err)
	})

	client.on('connect', () => {
		logger('Connected to GSSIOT MQTT server')
	})

	return client
}

module.exports = { createMqttClient }
