// // routes/report.daily.routes.js
// const express = require('express')
// const path = require('path')
// const fs = require('fs')
// const {
// 	buildDailyHwpxBuffer,
// } = require('../services/reportDailyCombined.service')

// let Building = null
// try {
// 	Building = require('../schema/Building.model')
// } catch {}

// const router = express.Router()

// function pad2(n) {
// 	return String(n).padStart(2, '0')
// }
// function toSeoulDate(dLike) {
// 	return new Date(`${dLike}T00:00:00+09:00`)
// }
// function endOfDaySeoul(dLike) {
// 	const d = toSeoulDate(dLike)
// 	d.setHours(23, 59, 59, 999)
// 	return d
// }
// function formatYMD(d) {
// 	const y = d.getFullYear()
// 	const m = pad2(d.getMonth() + 1)
// 	const dd = pad2(d.getDate())
// 	return `${y}-${m}-${dd}`
// }

// function parseRange(q) {
// 	const hasStart = !!q.start,
// 		hasEnd = !!q.end,
// 		hasDate = !!q.date
// 	const startRaw = hasStart ? q.start : hasDate ? q.date : null
// 	const endRaw = hasEnd
// 		? q.end
// 		: hasDate && !hasStart
// 		? q.date
// 		: hasStart
// 		? q.start
// 		: null
// 	let startStr = startRaw,
// 		endStr = endRaw
// 	if (!startStr && !endStr) {
// 		const today = formatYMD(new Date())
// 		startStr = today
// 		endStr = today
// 	}
// 	if (startStr && !endStr) endStr = startStr
// 	if (!startStr && endStr) startStr = endStr
// 	const t0 = toSeoulDate(startStr)
// 	const t1 = endOfDaySeoul(endStr)
// 	const ymdStart = formatYMD(t0),
// 		ymdEnd = formatYMD(t1)
// 	const single = ymdStart === ymdEnd
// 	const label = single ? ymdStart : `${ymdStart}~${ymdEnd}`
// 	return { t0, t1, label, ymdStart, ymdEnd, single }
// }

// function resolveTemplatePath() {
// 	const cands = [
// 		process.env.REPORT_TEMPLATE_PATH,
// 		path.join(process.cwd(), 'templates', 'daily_report.hwpx'),
// 		'/mnt/data/daily_report.hwpx',
// 	].filter(Boolean)
// 	for (const p of cands) {
// 		try {
// 			if (fs.existsSync(p)) return p
// 		} catch {}
// 	}
// 	return path.join(process.cwd(), 'templates', 'daily_report.hwpx')
// }

// router.get('/api/reports/daily-hwpx', async (req, res) => {
// 	try {
// 		const { buildingId } = req.query
// 		if (!buildingId)
// 			return res.status(400).json({ message: 'buildingId is required' })

// 		const { t0, t1, label } = parseRange(req.query)
// 		const templatePath = resolveTemplatePath()

// 		let namePart = buildingId
// 		if (Building) {
// 			try {
// 				const b = await Building.findById(buildingId).lean()
// 				if (b?.building_name) namePart = b.building_name
// 			} catch {}
// 		}

// 		const buf = await buildDailyHwpxBuffer({
// 			templatePath,
// 			buildingId,
// 			t0,
// 			t1,
// 			dateLabel: label, // 문서 {{date}} 전역 별칭에 사용
// 			extraMap: {
// 				// 혹시 템플릿에 추가 커스텀 키가 있을 경우 여기에 더 넣으세요.
// 			},
// 		})

// 		const filename = `보고서_${namePart}_${label}.hwpx`
// 		res.setHeader('Content-Type', 'application/zip')
// 		res.setHeader(
// 			'Content-Disposition',
// 			`attachment; filename="${encodeURI(filename)}"`
// 		)
// 		return res.send(buf)
// 	} catch (e) {
// 		console.error('[GET /api/reports/daily-hwpx] error:', e)
// 		return res
// 			.status(500)
// 			.json({ message: '보고서 생성 실패', error: String(e?.message || e) })
// 	}
// })

// module.exports = router
