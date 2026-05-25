const Weather = require('../weather/weather.model')
const Building = require('../building/building.model')

const OWM_TO_APP_WEATHER = {
	Clear: 'Clear',
	Clouds: 'Cloudy',
	Rain: 'Rain',
	Drizzle: 'Drizzle',
	Thunderstorm: 'Thunderstorm',
	Snow: 'Snow',
	Mist: 'Mist',
	Smoke: 'Smoke',
	Haze: 'Haze',
	Dust: 'Haze',
	Fog: 'Fog',
	Sand: 'Sand',
	Ash: 'Ash',
	Squall: 'Thunderstorm',
	Tornado: 'Tornado',
}

function normalizeWeatherValue(val) {
	if (!val || typeof val !== 'string') return 'Clear'
	const trimmed = val.trim()
	return OWM_TO_APP_WEATHER[trimmed] || trimmed
}

exports.createWeather = async (req, res, next) => {
	try {
		const payload = Array.isArray(req.body) ? req.body : [req.body]
		if (!payload.length)
			return res.status(400).json({ message: '빈 payload 입니다.' })
		if (!payload[0].building)
			return res.status(400).json({ message: 'building 필드가 필요합니다.' })

		const building = await Building.findById(payload[0].building).lean()
		if (!building)
			return res.status(404).json({ message: '존재하지 않는 빌딩입니다.' })

		// ✅ 여기서는 timestamp 보정하지 않음 (스키마 setter가 처리)
		const docs = payload.map(d => ({
			...d,
			weather: normalizeWeatherValue(d.weather),
		}))

		const created = await Weather.insertMany(docs)
		res.status(201).json({ count: created.length, data: created })
	} catch (err) {
		next(err)
	}
}

exports.getWeatherList = async (req, res, next) => {
	try {
		let {
			buildingId,
			from,
			to,
			page = 1,
			limit = 20,
			sort = '-timestamp',
		} = req.query
		page = Number(page) || 1
		limit = Math.min(Math.max(Number(limit) || 20, 1), 200)

		const q = {}
		if (buildingId) q.building = buildingId
		if (from || to) {
			q.timestamp = {}
			if (from) q.timestamp.$gte = new Date(from)
			if (to) q.timestamp.$lte = new Date(to)
		}

		const skip = (page - 1) * limit
		const [items, total] = await Promise.all([
			Weather.find(q).sort(sort).skip(skip).limit(limit).lean(),
			Weather.countDocuments(q),
		])

		res.json({ page, limit, total, data: items })
	} catch (err) {
		next(err)
	}
}

exports.getWeatherById = async (req, res, next) => {
	try {
		const doc = await Weather.findById(req.params.id).lean()
		if (!doc) return res.status(404).json({ message: '데이터가 없습니다.' })
		res.json(doc)
	} catch (err) {
		next(err)
	}
}

exports.getLatestWeather = async (req, res, next) => {
	try {
		const { buildingId } = req.query
		if (!buildingId)
			return res.status(400).json({ message: 'buildingId가 필요합니다.' })
		const doc = await Weather.findOne({ building: buildingId })
			.sort('-timestamp')
			.lean()
		if (!doc)
			return res
				.status(404)
				.json({ message: '해당 빌딩의 날씨 데이터가 없습니다.' })
		res.json(doc)
	} catch (err) {
		next(err)
	}
}

exports.getWindSeriesForBuilding = async (req, res, next) => {
	try {
		const { id: buildingId } = req.params
		const { from, to, sort = 'timestamp', unit } = req.query
		// sort: 'timestamp' | '-timestamp'  (기본: 오름차순)

		if (!buildingId)
			return res.status(400).json({ message: 'buildingId가 필요합니다.' })

		const building = await Building.findById(buildingId).lean()
		if (!building)
			return res.status(404).json({ message: '존재하지 않는 빌딩입니다.' })

		const q = { building: buildingId }
		if (from || to) {
			q.timestamp = {}
			if (from) q.timestamp.$gte = new Date(from)
			if (to) q.timestamp.$lte = new Date(to)
		}

		// 필요한 필드만 가져오기 (그래프용 최소 페이로드)
		const projection = { _id: 0, timestamp: 1, wind_speed: 1 } // 스키마에 맞게 필드명 확인
		const items = await Weather.find(q).select(projection).sort(sort).lean()

		// 단위 변환(옵션): ?unit=kmh 로 주면 m/s -> km/h
		let data = items
		let unitLabel = 'm/s'
		if (unit && unit.toLowerCase() === 'kmh') {
			data = items.map(it => ({
				timestamp: it.timestamp,
				wind_speed:
					typeof it.wind_speed === 'number'
						? Number((it.wind_speed * 3.6).toFixed(2))
						: it.wind_speed,
			}))
			unitLabel = 'km/h'
		}

		return res.json({
			building: { _id: building._id, name: building.name ?? undefined },
			count: data.length,
			unit: unitLabel,
			sort,
			data, // [{ timestamp, windSpeed }]
		})
	} catch (err) {
		next(err)
	}
}
