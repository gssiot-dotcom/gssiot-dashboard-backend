// //최신값 반환해주는 코드
// // routes/angleHistory.routes.js
// const express = require('express');
// const router = express.Router();
// const AngleNodeHistory = require('../schema/Angle.node.history.model');

// /**
//  * 각도 히스토리 최신 1건 조회
//  * GET /api/angles/history/latest?doorNum=123
//  * - doorNum 미지정 시: 전체에서 최신 1건
//  * - doorNum 지정 시: 해당 도어의 최신 1건
//  */
// router.get('/angles/history/latest', async (req, res) => {
//   try {
//     const filter = {};
//     if (req.query.doorNum !== undefined && req.query.doorNum !== null) {
//       const n = Number(req.query.doorNum);
//       if (!Number.isFinite(n)) {
//         return res.status(400).json({ message: 'Invalid doorNum' });
//       }
//       filter.doorNum = n;
//     }

//     // createdAt(타임스탬프) 우선 정렬, 없을 때 _id 역순으로 근사 최신
//     const latest = await AngleNodeHistory.findOne(filter)
//       .sort({ createdAt: -1, _id: -1 })
//       .lean();

//     if (!latest) {
//       return res.status(404).json({ message: 'No angle history found' });
//     }

//     return res.json({ history: latest });
//   } catch (e) {
//     console.error('[angles/history/latest] error:', e);
//     return res.status(500).json({ message: 'Failed to get latest angle history' });
//   }
// });

// module.exports = router;
