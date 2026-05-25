const mongoose = require('mongoose')
const { logError } = require('../../lib/logger')
const AlertLog = require('./alert.model')
const { Parser } = require('json2csv')

let alertController = module.exports

// =============== 유틸 함수 =============== //
function toNum(v, def) {
	const n = Number(v)
	return Number.isFinite(n) ? n : def
}

function parseDateRange({ start, end }) {
	let startDate
	let endDate

	if (start) {
		const s = new Date(start)
		if (!isNaN(s)) startDate = s
	}
	if (end) {
		const e = new Date(end)
		if (!isNaN(e)) endDate = e
	}

	if (startDate && !endDate) {
		endDate = new Date()
	}

	return { startDate, endDate }
}

alertController.getAlertions = async (req, res) => {
	console.log('GetAlert::')
	try {
		const page = Math.max(1, toNum(req.query.page, 1))
		const limitParam = toNum(req.query.limit, 20)
		const limit = limitParam === 0 ? 0 : Math.min(200, Math.max(1, limitParam))
		const skip = (page - 1) * (limit || 0)

		const {
			level,
			building,
			gateway_serial,
			doorNum,
			metric,
			start,
			end,
			sort,
		} = req.query

		const query = {}

		if (level && ['yellow', 'red'].includes(level)) query.level = level
		if (building && mongoose.isValidObjectId(building)) {
			query.building = new mongoose.Types.ObjectId(building)
		}
		if (gateway_serial) query.gateway_serial = String(gateway_serial)
		if (doorNum !== undefined) {
			const d = Number(doorNum)
			if (Number.isFinite(d)) query.doorNum = d
		}
		if (metric && ['angle_x', 'angle_y'].includes(metric)) query.metric = metric

		const { startDate, endDate } = parseDateRange({ start, end })
		if (startDate && endDate)
			query.createdAt = { $gte: startDate, $lte: endDate }
		else if (startDate) query.createdAt = { $gte: startDate }
		else if (endDate) query.createdAt = { $lte: endDate }

		let sortObj = { createdAt: -1 }
		if (sort) {
			const allowed = [
				'createdAt',
				'-createdAt',
				'value',
				'-value',
				'threshold',
				'-threshold',
			]
			if (allowed.includes(sort)) {
				sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 }
			}
		}

		let q = AlertLog.find(query)
			.populate('building', '_id name')
			.populate('gateway', '_id serial_number')
			.populate('node', '_id doorNum')
			.sort(sortObj)

		if (limit > 0) {
			q = q.skip(skip).limit(limit)
		}

		const [items, total] = await Promise.all([
			q.lean(),
			AlertLog.countDocuments(query),
		])

		return res.json({
			ok: true,
			page,
			limit,
			total,
			totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
			items,
		})
	} catch (err) {
		logError('GET /api/alert-logs error:', err)
		res.status(500).json({ ok: false, message: err.message })
	}
}

alertController.getAlertByID = async (req, res) => {
	try {
		const { id } = req.params
		// if (!mongoose.isValidObjectId(id)) {
		// 	return res.status(400).json({ ok: false, message: 'Invalid id' })
		// }

		const doc = await AlertLog.findById(id)
			.populate('building', '_id name')
			.populate('gateway', '_id serial_number')
			.populate('node', '_id doorNum')
			.lean()

		if (!doc) {
			return res.status(404).json({ ok: false, message: 'Not found' })
		}

		res.json({ ok: true, item: doc })
	} catch (err) {
		logError('GET /api/alert-logs/:id error:', err)
		res.status(500).json({ ok: false, message: err.message })
	}
}

alertController.getStatsSummary = async (req, res) => {
	try {
		const { building, gateway_serial, doorNum, metric, start, end } = req.query
		const match = {}

		if (building && mongoose.isValidObjectId(building)) {
			match.building = new mongoose.Types.ObjectId(building)
		}
		if (gateway_serial) match.gateway_serial = String(gateway_serial)
		if (doorNum !== undefined) {
			const d = Number(doorNum)
			if (Number.isFinite(d)) match.doorNum = d
		}
		if (metric && ['angle_x', 'angle_y'].includes(metric)) match.metric = metric

		const { startDate, endDate } = parseDateRange({ start, end })
		if (startDate && endDate)
			match.createdAt = { $gte: startDate, $lte: endDate }
		else if (startDate) match.createdAt = { $gte: startDate }
		else if (endDate) match.createdAt = { $lte: endDate }

		const agg = await AlertLog.aggregate([
			{ $match: match },
			{ $group: { _id: '$level', count: { $sum: 1 } } },
		])

		const counts = { yellow: 0, red: 0 }
		for (const row of agg) {
			if (row._id === 'yellow') counts.yellow = row.count
			if (row._id === 'red') counts.red = row.count
		}

		res.json({ ok: true, counts })
	} catch (err) {
		logError('GET /api/alert-logs/stats error:', err)
		res.status(500).json({ ok: false, message: err.message })
	}
}

alertController.getAlertRecentList = async (req, res) => {
	try {
		const limit = Math.min(200, Math.max(1, toNum(req.query.limit, 50)))
		const items = await AlertLog.find({})
			.sort({ createdAt: -1 })
			.limit(limit)
			.lean()

		res.json({ ok: true, limit, items })
	} catch (err) {
		logError('GET /api/alert-logs/recent error:', err)
		res.status(500).json({ ok: false, message: err.message })
	}
}

alertController.exportCSV = async (req, res) => {
	try {
		const { level, building, gateway_serial, doorNum, metric, start, end } =
			req.query
		const query = {}

		if (level && ['yellow', 'red'].includes(level)) query.level = level
		if (building && mongoose.isValidObjectId(building)) {
			query.building = new mongoose.Types.ObjectId(building)
		}
		if (gateway_serial) query.gateway_serial = String(gateway_serial)
		if (doorNum !== undefined) {
			const d = Number(doorNum)
			if (Number.isFinite(d)) query.doorNum = d
		}
		if (metric && ['angle_x', 'angle_y'].includes(metric)) query.metric = metric

		const { startDate, endDate } = parseDateRange({ start, end })
		if (startDate && endDate)
			query.createdAt = { $gte: startDate, $lte: endDate }
		else if (startDate) query.createdAt = { $gte: startDate }
		else if (endDate) query.createdAt = { $lte: endDate }

		const logs = await AlertLog.find(query)
			.populate('building', '_id name')
			.populate('gateway', 'serial_number')
			.populate('node', 'doorNum')
			.sort({ createdAt: -1 })
			.lean()

		// ✅ UTC → KST 변환 함수
		function toKSTString(date) {
			if (!date) return ''
			const d = new Date(date)
			const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000) // +9시간
			const yyyy = kst.getFullYear()
			const mm = String(kst.getMonth() + 1).padStart(2, '0')
			const dd = String(kst.getDate()).padStart(2, '0')
			const hh = String(kst.getHours()).padStart(2, '0')
			const mi = String(kst.getMinutes()).padStart(2, '0')
			const ss = String(kst.getSeconds()).padStart(2, '0')
			return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
		}

		const fields = [
			{ label: 'Time(KST)', value: row => toKSTString(row.createdAt) },
			{
				label: 'BuildingId',
				value: row => row.building?._id?.toString?.() || '',
			},
			{ label: 'BuildingName', value: row => row.building?.name || '' },
			{
				label: 'Gateway',
				value: row => row.gateway?.serial_number || row.gateway_serial || '',
			},
			{ label: 'DoorNum', value: 'doorNum' },
			{ label: 'Metric', value: 'metric' },
			{ label: 'Level', value: 'level' },
			{ label: 'Value', value: 'value' },
			{ label: 'Threshold', value: 'threshold' },
		]

		const parser = new Parser({ fields })
		const csv = parser.parse(logs)

		res.header('Content-Type', 'text/csv')
		res.attachment('alert_logs.csv')
		return res.send(csv)
	} catch (err) {
		console.error('GET /api/alert-logs/export/csv error:', err)
		res.status(500).json({ ok: false, message: err.message })
	}
}
