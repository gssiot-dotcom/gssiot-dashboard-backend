// // routes/angleCalibration.routes.js
// const express = require('express');
// const router = express.Router();
// const AngleCalibration = require('../schema/Angle.Calibration.model');
// const AngleNode = require('../schema/Angle.node.model');

// // ---- 유틸: doorNum 파싱(문자/숫자/배열/콤마문자열 모두 허용) ----
// function parseDoorNums(reqBody = {}, allDoors = []) {
//   // 우선순위: doorNum > doorNums(array) > doorNums(string "1,2,3") > (없으면 전체)
//   const out = new Set();

//   // 1) 단일 doorNum
//   if (reqBody.doorNum !== undefined && reqBody.doorNum !== null) {
//     const n = Number(reqBody.doorNum);
//     if (Number.isFinite(n)) out.add(n);
//   }

//   // 2) 배열 doorNums
//   if (Array.isArray(reqBody.doorNums)) {
//     for (const v of reqBody.doorNums) {
//       const n = Number(v);
//       if (Number.isFinite(n)) out.add(n);
//     }
//   }

//   // 3) 콤마 문자열 doorNums: "1,2,3"
//   if (typeof reqBody.doorNums === 'string') {
//     for (const s of reqBody.doorNums.split(',')) {
//       const n = Number(s.trim());
//       if (Number.isFinite(n)) out.add(n);
//     }
//   }

//   // 아무것도 못 뽑았으면 전체
//   if (out.size === 0) return [...allDoors];
//   return [...out];
// }

// // ---- 유틸: sampleTarget 파싱(문자도 허용, 기본 5) ----
// function parseSampleTarget(v) {
//   const n = Number.parseInt(v, 10);
//   return Number.isFinite(n) && n > 0 ? n : 5;
// }

// /**
//  * 보정 수집 시작 (전체/부분/단일)
//  * POST /api/angles/calibration/start-all
//  * body: { doorNum?: number|string, doorNums?: number[] | "1,2,3", sampleTarget?: number|string }
//  */
// router.post('/angles/calibration/start-all', async (req, res) => {
//   try {
//     // 등록된 도어 목록(없으면 에러)
//     const allDoors = await AngleNode.distinct('doorNum');
//     if (!allDoors?.length) {
//       return res.status(400).json({ message: 'No doors registered in AngleNode' });
//     }

//     const doors = parseDoorNums(req.body, allDoors);
//     if (!doors.length) {
//       return res.status(400).json({ message: 'No valid doors resolved from request' });
//     }

//     const target = parseSampleTarget(req.body?.sampleTarget);
//     const now = new Date();

//     const ops = doors.map(dn => ({
//       updateOne: {
//         filter: { doorNum: dn },
//         update: {
//           $set: {
//             applied: false,
//             offsetX: 0,
//             offsetY: 0,
//             collecting: true,
//             sampleTarget: target,
//             sampleCount: 0,
//             sumX: 0,
//             sumY: 0,
//             startedAt: now,
//           },
//         },
//         upsert: true,
//       },
//     }));

//     const result = await AngleCalibration.bulkWrite(ops, { ordered: false });

//     return res.json({
//       message: `Calibration collecting started for ${doors.length} door(s)`,
//       target,
//       doors, // ✅ 무엇을 대상으로 했는지 응답에서 바로 확인 가능
//       matched: result.matchedCount ?? undefined,
//       upserted: result.upsertedCount ?? undefined,
//       modified: result.modifiedCount ?? undefined,
//     });
//   } catch (e) {
//     console.error('[start-all] error:', e);
//     return res.status(500).json({ message: 'Failed to start calibration' });
//   }
// });

// /**
//  * 보정 수집 취소/리셋 (전체/부분/단일)
//  * POST /api/angles/calibration/cancel-all
//  * body: { doorNum?: number|string, doorNums?: number[] | "1,2,3", resetOffset?: boolean }
//  */
// router.post('/angles/calibration/cancel-all', async (req, res) => {
//   try {
//     const allDoors = await AngleNode.distinct('doorNum');
//     if (!allDoors?.length) {
//       return res.status(400).json({ message: 'No doors registered in AngleNode' });
//     }

//     const doors = parseDoorNums(req.body, allDoors);
//     if (!doors.length) {
//       return res.status(400).json({ message: 'No valid doors resolved from request' });
//     }

//     const resetOffset = !!req.body?.resetOffset;

//     const set = {
//       collecting: false,
//       sampleCount: 0,
//       sumX: 0,
//       sumY: 0,
//       startedAt: null,
//     };
//     if (resetOffset) {
//       set.applied = false;
//       set.offsetX = 0;
//       set.offsetY = 0;
//       set.appliedAt = null;
//     }

//     const result = await AngleCalibration.updateMany(
//       { doorNum: { $in: doors } },
//       { $set: set }
//     );

//     return res.json({
//       message: `Calibration collecting canceled for ${doors.length} door(s)`,
//       resetOffset,
//       doors, // ✅ 무엇을 대상으로 했는지 응답에서 확인
//       matched: result.matchedCount ?? undefined,
//       modified: result.modifiedCount ?? undefined,
//     });
//   } catch (e) {
//     console.error('[cancel-all] error:', e);
//     return res.status(500).json({ message: 'Failed to cancel calibration' });
//   }
// });

// /**
//  * 상태 조회 (전체 또는 쿼리로 일부)
//  * GET /api/angles/calibration?doorNums=1,2,3
//  */
// router.get('/angles/calibration', async (req, res) => {
//   try {
//     let filter = {};
//     if (typeof req.query.doorNums === 'string' && req.query.doorNums.trim()) {
//       const doors = req.query.doorNums
//         .split(',')
//         .map(s => Number(s.trim()))
//         .filter(Number.isFinite);
//       if (doors.length) filter = { doorNum: { $in: doors } };
//     }

//     const list = await AngleCalibration.find(filter).lean();
//     return res.json({ count: list.length, calibrations: list });
//   } catch (e) {
//     console.error('[get] error:', e);
//     return res.status(500).json({ message: 'Failed to get calibrations' });
//   }
// });

// module.exports = router;
