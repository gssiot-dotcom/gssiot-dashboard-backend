// services/weatherIngest.service.js
// 빌딩 주소 -> 지오코딩 -> 날씨 호출 -> Weather 저장 (+ 태풍 EFF만 추가)
// 저장/실패/스킵 모두 콘솔 로그 출력

const axios = require('axios')
const Building = require('../building/building.model')
const Weather = require('../weather/weather.model')
const { geocodeAddress } = require('./geocode.service') // services/geocode.service.js
const { degToCompass } = require('../../utils/wind') // utils/wind.js
const { logger, logError, logWarn } = require('../../lib/logger')

const OWM_KEY = process.env.OWM_API_KEY
const KMA_KEY = process.env.KMA_API_KEY // ← 추가: 기상청 API 허브 키(태풍 EFF 조회용)
const VERBOSE = (process.env.LOG_VERBOSE || 'false').toLowerCase() === 'true'

// ───────────────────────────────────────────────────────────────
// 내부: OpenWeatherMap 현재 날씨 조회(lat, lon)
// ───────────────────────────────────────────────────────────────
async function fetchWeatherByCoords(lat, lon) {
	const url = 'https://api.openweathermap.org/data/2.5/weather'
	const params = { lat, lon, appid: OWM_KEY, units: 'metric' } // ℃

	const { data } = await axios.get(url, { params })

	//지오 코딩 콘솔 로그 출력 코드
	// if (VERBOSE) {
	//   console.log('[weather][owm][raw]', {
	//     lat, lon,
	//     main: data.weather?.[0]?.main,
	//     temp: data.main?.temp,
	//     hum: data.main?.humidity,
	//     ws: data.wind?.speed,
	//     deg: data.wind?.deg,
	//   })
	// }

	const weatherMain = data.weather?.[0]?.main || 'Clear'
	const windDeg = typeof data.wind?.deg === 'number' ? data.wind.deg : undefined

	return {
		weather: weatherMain, // Clear, Rain, ...
		wind_direction: degToCompass(windDeg), // N, NE, ...
		temperature: data.main?.temp, // ℃
		humidity: data.main?.humidity, // %
		wind_speed: data.wind?.speed, // m/s
		timestamp: new Date(), // 수집 시각(서버)
	}
}

// ───────────────────────────────────────────────────────────────
// 내부: 기상청 API 허브 typ01 목록으로 최신 태풍 EFF(1~4) 가져오기
// 실패/미응답 시 4(없음) 반환
// ───────────────────────────────────────────────────────────────
function utcNowYYYYMMDDHHmm() {
	const d = new Date()
	const y = d.getUTCFullYear()
	const M = String(d.getUTCMonth() + 1).padStart(2, '0')
	const D = String(d.getUTCDate()).padStart(2, '0')
	const h = String(d.getUTCHours()).padStart(2, '0')
	const m = String(d.getUTCMinutes()).padStart(2, '0')
	return `${y}${M}${D}${h}${m}`
}

function clean(s) {
	return (s ?? '')
		.toString()
		.trim()
		.replace(/^"+|"+$/g, '')
}

/**
 * 기상청 API 허브 typ01 목록
 * - URL: https://apihub.kma.go.kr/api/typ01/url/typ_lst.php
 * - 파라미터: tm(UTC, 과거12h), disp=1(CSV), help=0, authKey=KMA_KEY
 * - 응답 CSV의 4번째 컬럼(EFF)을 1|2|3|4로 해석
 */
async function fetchLatestTyphoonEFF() {
	try {
		if (!KMA_KEY) {
			if (VERBOSE) logWarn('[typhoon][eff] KMA_API_KEY missing, fallback 4')
			return 4
		}
		const url = 'https://apihub.kma.go.kr/api/typ01/url/typ_lst.php'
		const params = {
			tm: utcNowYYYYMMDDHHmm(),
			disp: 1,
			help: 0,
			authKey: KMA_KEY,
		}
		const { data: text } = await axios.get(url, {
			params,
			responseType: 'text',
			timeout: 15000,
		})

		const lines = String(text)
			.split(/\r?\n/)
			.map(l => l.trim())
			.filter(
				l =>
					l &&
					!/^#/.test(l) &&
					!/^=/.test(l) &&
					!/^\/\//.test(l) &&
					!/^---/.test(l),
			)

		// 가장 최신 한 줄만 보고 EFF 파싱(컬럼 4 = index 3)
		for (const raw of lines) {
			const cols = raw.split(',').map(clean)
			const eff = parseInt(cols[3], 10) // 1:상륙, 2:직접영향, 3:간접영향, 4:없음
			if ([1, 2, 3, 4].includes(eff)) {
				if (VERBOSE) logger('[typhoon][eff] parsed:', eff)
				return eff
			}
		}
		if (VERBOSE) logWarn('[typhoon][eff] no valid EFF found, fallback 4')
		return 4
	} catch (e) {
		if (VERBOSE) logWarn('[typhoon][eff] fetch fail:', e.message)
		return 4
	}
}

// ───────────────────────────────────────────────────────────────
// 공개: 전체 빌딩 순회 수집
// ───────────────────────────────────────────────────────────────
exports.ingestAllBuildingsWeather = async () => {
	if (!OWM_KEY) {
		logError('[weather][start] OWM_API_KEY(.env) 누락')
		throw new Error('OWM_API_KEY is required')
	}

	const startedAt = new Date()
	logger('[weather][start]', { at: startedAt.toISOString() })

	// ✨ 실행 시점의 태풍 영향도 1회 조회(전국 공통 적용)
	const typhoonEff = await fetchLatestTyphoonEFF() // 1~4, 실패 시 4

	// 주소가 있는 빌딩만
	const cursor = Building.find(
		{ building_addr: { $ne: null, $exists: true, $type: 'string' } },
		{ _id: 1, building_addr: 1, building_name: 1 },
	).cursor()

	let ok = 0,
		fail = 0,
		skip = 0,
		total = 0

	for await (const b of cursor) {
		total++
		const bid = String(b._id)
		const addr = b.building_addr
		const name = b.building_name || ''

		// 1) 지오코딩
		let coord = null
		try {
			coord = await geocodeAddress(addr)
			if (!coord) {
				skip++
				logWarn('[weather][skip][geocode-null]', {
					building: bid,
					name,
					addr,
				})
				continue
			}
			if (VERBOSE) {
				logger('[weather][geocode]', {
					building: bid,
					name,
					lat: coord.lat,
					lon: coord.lon,
				})
			}
		} catch (e) {
			fail++
			logError('[weather][fail][geocode]', {
				building: bid,
				name,
				addr,
				msg: e.message,
			})
			continue
		}

		// 2) 날씨 호출
		let w = null
		try {
			w = await fetchWeatherByCoords(coord.lat, coord.lon)
			if (VERBOSE) {
				logger('[weather][mapped]', { building: bid, name, ...w })
			}
		} catch (e) {
			fail++
			logError('[weather][fail][owm]', {
				building: bid,
				name,
				msg: e.message,
			})
			continue
		}

		// 3) 저장 (+ 태풍 영향도 한 줄)
		try {
			const saved = await Weather.create({
				building: b._id,
				weather: w.weather,
				wind_direction: w.wind_direction,
				temperature: w.temperature,
				humidity: w.humidity,
				wind_speed: w.wind_speed,
				timestamp: w.timestamp,

				// ✅ 추가: 태풍 영향(EFF) — 1:상륙, 2:직접영향, 3:간접영향, 4:없음
				typhoon_eff: typhoonEff,
			})

			ok++
			logger('[weather][saved]', {
				building: bid,
				name,
				_id: String(saved._id),
				weather: saved.weather,
				temp: saved.temperature,
				hum: saved.humidity,
				ws: saved.wind_speed,
				ts: saved.timestamp?.toISOString?.() || saved.timestamp,
				eff: saved.typhoon_eff,
			})
		} catch (e) {
			fail++
			// 스키마 enum 불일치나 ValidationError 가능
			logError('[weather][fail][save]', {
				building: bid,
				name,
				msg: e.message,
			})
			continue
		}

		// 무료/유료 API 쿼터 보호 (필요 시 조정/삭제)
		await sleep(VERBOSE ? 200 : 500)
	}

	const endedAt = new Date()
	const ms = endedAt - startedAt

	return { total, ok, fail, skip, took_ms: ms }
}

// ───────────────────────────────────────────────────────────────
// 헬퍼
// ───────────────────────────────────────────────────────────────
function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}
