// src/server.js
require('dotenv').config()

const http = require('http')
const mongoose = require('mongoose')
const cron = require('node-cron')
const { Server } = require('socket.io')

const { app, allowedOrigins } = require('./app')
const { initMqtt } = require('./infrastructure/mqtt')
const { initSocket } = require('./infrastructure/socket')
const { startHeartbeatJob } = require('./services/heartBeat.service')
const {
	ingestAllBuildingsWeather,
} = require('./modules/weather/weatherIngest.service')
const { logger, logError } = require('./lib/logger')

const server = http.createServer(app)

// Socket.IO (Express CORS dan alohida)
const io = new Server(server, {
	cors: {
		origin: allowedOrigins,
		methods: ['GET', 'POST', 'OPTIONS'],
		credentials: true,
	},
})

// === SocketIO & MQTT connection === //

initSocket(io)
initMqtt()

const PORT = process.env.PORT || 3000
let heartbeat
let weatherCronTask

const startServer = async () => {
	try {
		const mongoUri = process.env.MONGO_URI || ''

		await mongoose.connect(mongoUri)
		console.log('MongoDB connected successfully')

		// Heartbeat job
		heartbeat = startHeartbeatJob({
			intervalMs: 20 * 60 * 1000,
			windowMs: 20 * 60 * 1000,
		})

		// Weather cron (DB ulanganidan keyin ishlasin)
		weatherCronTask = cron.schedule('*/10 * * * *', async () => {
			try {
				const { ok, fail } = await ingestAllBuildingsWeather()
				logger(`[weather cron] saved: ${ok}, failed: ${fail}`)
			} catch (e) {
				logError('[weather cron] error:', e.message)
			}
		})

		server.listen(PORT, () => {
			console.log(`Server is running on: http://localhost:${PORT}`)
		})
	} catch (error) {
		console.error('Server start error:', error)
		process.exit(1)
	}
}

startServer()

// Graceful shutdown
const graceful = async signal => {
	console.log(`[${signal}] shutting down...`)

	try {
		if (heartbeat?.stop) heartbeat.stop()
	} catch {}
	try {
		if (weatherCronTask?.stop) weatherCronTask.stop()
	} catch {}

	// 1) HTTP serverni yopish
	await new Promise(resolve => server.close(resolve))

	// 2) Mongo connectionni yopish (callback yo‘q!)
	try {
		await mongoose.connection.close()
		console.log('[MongoDB] connection closed')
	} catch (err) {
		console.error('[MongoDB] close error:', err)
	} finally {
		process.exit(0)
	}
}

process.on('SIGINT', () => graceful('SIGINT'))
process.on('SIGTERM', () => graceful('SIGTERM'))
