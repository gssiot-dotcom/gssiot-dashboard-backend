const path = require('path')
const fs = require('fs')
const Building = require('../building/building.model')
const { buildDailyHwpxBuffer } = require('./reportDailyCombined.service')
const {
	buildTable1Map,
	fillHwpxZipStrictBuffer,
} = require('./reportTable1.service')

let reportController = module.exports

reportController.getReportDailyHWP = async (req, res) => {
	try {
		const { buildingId } = req.query
		if (!buildingId)
			return res.status(400).json({ message: 'buildingId is required' })

		const { t0, t1, label } = parseRange(req.query)
		const templatePath = resolveTemplatePath()

		let namePart = buildingId
		if (Building) {
			try {
				const b = await Building.findById(buildingId).lean()
				if (b?.building_name) namePart = b.building_name
			} catch {}
		}

		const buf = await buildDailyHwpxBuffer({
			templatePath,
			buildingId,
			t0,
			t1,
			dateLabel: label, // 문서 {{date}} 전역 별칭에 사용
			extraMap: {
				// 혹시 템플릿에 추가 커스텀 키가 있을 경우 여기에 더 넣으세요.
			},
		})

		const filename = `보고서_${namePart}_${label}.hwpx`
		res.setHeader('Content-Type', 'application/zip')
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${encodeURI(filename)}"`,
		)
		return res.send(buf)
	} catch (e) {
		console.error('[GET /api/reports/daily-hwpx] error:', e)
		return res
			.status(500)
			.json({ message: '보고서 생성 실패', error: String(e?.message || e) })
	}
}

reportController.getTable1 = async (req, res) => {
	try {
		const { start, end, buildingId, doorNums } = req.query
		if (!start || !end)
			return res.status(400).json({ message: 'start, end 필요 (YYYY-MM-DD)' })

		const { t0, t1 } = dayRangeKST(start, end)
		const doorNumsArr = (doorNums || '')
			.split(',')
			.map(s => s.trim())
			.filter(Boolean)
			.map(v => (isNaN(Number(v)) ? v : Number(v)))

		// 1) 데이터 집계
		const map = await buildTable1Map({
			t0,
			t1,
			buildingId: buildingId || undefined,
			doorNums: doorNumsArr.length ? doorNumsArr : undefined,
		})

		// 2) 파일명 생성 (디스크 저장 없이)
		const bname = sanitizeFileName(await getBuildingName(buildingId))
		const singleDay = start === end
		const outName = singleDay
			? `${bname}_${kDateLabel(start)}_일일 보고서.hwpx`
			: `${bname}_${kDateLabel(start)}~${kDateLabel(end)}_기간 보고서.hwpx`

		// 3) 메모리에서 즉시 생성하여 바로 전송
		const templatePath = resolveTemplatePath()

		const buffer = fillHwpxZipStrictBuffer(templatePath, map)

		res.attachment(outName) // Content-Disposition: attachment; filename=...
		res.type('application/zip') // HWPX는 zip 기반
		return res.send(buffer) // 디스크 저장 없이 바로 응답
	} catch (e) {
		console.error('[table1] error:', e)
		res.status(500).json({ message: e.message || String(e) })
	}
}

//  ------------------- getReportDailyHWP Additional functions ---------------- //

function pad2(n) {
	return String(n).padStart(2, '0')
}
function toSeoulDate(dLike) {
	return new Date(`${dLike}T00:00:00+09:00`)
}
function endOfDaySeoul(dLike) {
	const d = toSeoulDate(dLike)
	d.setHours(23, 59, 59, 999)
	return d
}
function formatYMD(d) {
	const y = d.getFullYear()
	const m = pad2(d.getMonth() + 1)
	const dd = pad2(d.getDate())
	return `${y}-${m}-${dd}`
}

function parseRange(q) {
	const hasStart = !!q.start,
		hasEnd = !!q.end,
		hasDate = !!q.date
	const startRaw = hasStart ? q.start : hasDate ? q.date : null
	const endRaw = hasEnd
		? q.end
		: hasDate && !hasStart
			? q.date
			: hasStart
				? q.start
				: null
	let startStr = startRaw,
		endStr = endRaw
	if (!startStr && !endStr) {
		const today = formatYMD(new Date())
		startStr = today
		endStr = today
	}
	if (startStr && !endStr) endStr = startStr
	if (!startStr && endStr) startStr = endStr
	const t0 = toSeoulDate(startStr)
	const t1 = endOfDaySeoul(endStr)
	const ymdStart = formatYMD(t0),
		ymdEnd = formatYMD(t1)
	const single = ymdStart === ymdEnd
	const label = single ? ymdStart : `${ymdStart}~${ymdEnd}`
	return { t0, t1, label, ymdStart, ymdEnd, single }
}

function resolveTemplatePath() {
	const cands = [
		path.join(process.cwd(), 'src', 'templates', 'daily_report.hwpx'),
	].filter(Boolean)

	for (const p of cands) {
		try {
			if (fs.existsSync(p)) return p
		} catch {}
	}

	throw new Error(`템플릿 파일을 찾을 수 없습니다: ${cands.join(', ')}`)
}

//  ------------------- getTable1 Additional functions ---------------- //

/** buildingId -> building_name (단일 필드) */
async function getBuildingName(buildingId) {
	if (!buildingId) return '전체'
	if (!mongoose.isValidObjectId(buildingId)) return String(buildingId).trim() // 이름 문자열일 수 있음
	const doc = await Building.findById(buildingId).select('building_name').lean()
	return (doc?.building_name ?? String(buildingId)).trim()
}

/** 'YYYY-MM-DD' → 'M월 D일'(KST) */
function kDateLabel(iso) {
	const d = new Date(`${iso}T00:00:00+09:00`)
	return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 파일명 금지문자 제거 */
function sanitizeFileName(name) {
	return String(name)
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
}

/** 하루 범위(KST) */
function dayRangeKST(startISO, endISO) {
	return {
		t0: new Date(`${startISO}T00:00:00+09:00`),
		t1: new Date(`${endISO}T23:59:59+09:00`),
	}
}
