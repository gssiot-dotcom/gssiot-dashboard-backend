// // routes/reportTable1.routes.js
// const path = require('path');
// const express = require('express');
// const mongoose = require('mongoose');
// const router = express.Router();

// const { buildTable1Map, fillHwpxZipStrictBuffer } = require('../services/reportTable1.service');

// // ⬇ Building 모델 경로 확인
// const Building = require('../schema/Building.model');

// /** buildingId -> building_name (단일 필드) */
// async function getBuildingName(buildingId) {
//   if (!buildingId) return '전체';
//   if (!mongoose.isValidObjectId(buildingId)) return String(buildingId).trim(); // 이름 문자열일 수 있음
//   const doc = await Building.findById(buildingId).select('building_name').lean();
//   return (doc?.building_name ?? String(buildingId)).trim();
// }

// /** 'YYYY-MM-DD' → 'M월 D일'(KST) */
// function kDateLabel(iso) {
//   const d = new Date(`${iso}T00:00:00+09:00`);
//   return `${d.getMonth() + 1}월 ${d.getDate()}일`;
// }

// /** 파일명 금지문자 제거 */
// function sanitizeFileName(name) {
//   return String(name).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
// }

// /** 하루 범위(KST) */
// function dayRangeKST(startISO, endISO) {
//   return { t0: new Date(`${startISO}T00:00:00+09:00`), t1: new Date(`${endISO}T23:59:59+09:00`) };
// }

// /**
//  * GET /api/reports/table1
//  *   ?start=YYYY-MM-DD
//  *   &end=YYYY-MM-DD
//  *   [&buildingId=<ObjectId or name-string>]
//  *   [&doorNums=101,102]
//  */
// router.get('/table1', async (req, res) => {
//   try {
//     const { start, end, buildingId, doorNums } = req.query;
//     if (!start || !end) return res.status(400).json({ message: 'start, end 필요 (YYYY-MM-DD)' });

//     const { t0, t1 } = dayRangeKST(start, end);
//     const doorNumsArr = (doorNums || '')
//       .split(',')
//       .map(s => s.trim())
//       .filter(Boolean)
//       .map(v => (isNaN(Number(v)) ? v : Number(v)));

//     // 1) 데이터 집계
//     const map = await buildTable1Map({
//       t0, t1,
//       buildingId: buildingId || undefined,
//       doorNums: doorNumsArr.length ? doorNumsArr : undefined,
//     });

//     // 2) 파일명 생성 (디스크 저장 없이)
//     const bname = sanitizeFileName(await getBuildingName(buildingId));
//     const singleDay = start === end;
//     const outName = singleDay
//       ? `${bname}_${kDateLabel(start)}_일일 보고서.hwpx`
//       : `${bname}_${kDateLabel(start)}~${kDateLabel(end)}_기간 보고서.hwpx`;

//     // 3) 메모리에서 즉시 생성하여 바로 전송
//     const templatePath = process.env.REPORT_TEMPLATE || './templates/report_template.hwpx';
//     const buffer = fillHwpxZipStrictBuffer(templatePath, map);

//     res.attachment(outName);            // Content-Disposition: attachment; filename=...
//     res.type('application/zip');        // HWPX는 zip 기반
//     return res.send(buffer);            // 디스크 저장 없이 바로 응답
//   } catch (e) {
//     console.error('[table1] error:', e);
//     res.status(500).json({ message: e.message || String(e) });
//   }
// });

// module.exports = router;
