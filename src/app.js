const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path')
const router = require('./routes/index.route')

const app = express()

// ===== Allowed Origins =====
const defaultAllowedOrigins = [
	'https://infogssiot.com',
	'http://13.125.157.133:3001',
	'http://13.125.157.133',
	'http://localhost:5173',
	// 'http://192.168.1.102:3005',
]

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean)

const allowedOrigins = [
	...new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
]

// ===== CORS options =====
const corsOptions = {
	origin(origin, callback) {
		if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
		return callback(new Error('CORS policy violation: ' + origin))
	},
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
}

// ===== Middlewares =====
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
// app.use('/static', express.static(path.join(__dirname, 'static')))

app.use(cors(corsOptions))

// preflight
app.options('*', cors(corsOptions))

// ===== Basic routes =====
app.get('/health', (req, res) => res.status(200).json({ ok: true }))

// ===== Mount routes =====
app.use('/', router)

// ===== 404 =====
app.use((req, res, next) => {
	if (res.headersSent) return next()
	res.status(404).json({ message: 'Not Found' })
})

// ===== Error handler =====
app.use((err, req, res, next) => {
	console.error('[ERROR]', err)
	const status = err.status || (err.name === 'ValidationError' ? 400 : 500)
	res.status(status).json({
		message: err.message || '서버 오류',
		...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
	})
})

module.exports = { app, allowedOrigins }
