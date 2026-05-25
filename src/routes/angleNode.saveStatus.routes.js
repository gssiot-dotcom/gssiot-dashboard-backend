// // routes/angleNode.saveStatus.routes.js
// const express = require('express')
// const router = express.Router()
// const AngleNode = require('../schema/Angle.node.model')

// // [단일] 특정 doorNum의 save_status 변경(+ 변경 시각 기록)
// // PATCH /api/angle-nodes/:doorNum/save-status
// // body: { "save_status": true | false }
// router.patch('/:doorNum/save-status', async (req, res) => {
//   try {
//     const doorNum = Number(req.params.doorNum)
//     const { save_status } = req.body

//     if (!Number.isFinite(doorNum)) {
//       return res.status(400).json({ ok: false, message: 'doorNum이 유효하지 않습니다.' })
//     }
//     if (typeof save_status !== 'boolean') {
//       return res.status(400).json({ ok: false, message: 'save_status(boolean) 값이 필요합니다.' })
//     }

//     // 현재 값 확인
//     const current = await AngleNode.findOne({ doorNum }).lean()
//     if (!current) {
//       return res.status(404).json({ ok: false, message: `doorNum=${doorNum} 노드를 찾을 수 없습니다.` })
//     }

//     // 값이 동일하면 변경 없이 그대로 반환 (변경 시각도 그대로 유지)
//     if (current.save_status === save_status) {
//       return res.json({
//         ok: true,
//         message: `변경 없음: doorNum=${doorNum} save_status는 이미 ${save_status} 입니다.`,
//         data: {
//           doorNum: current.doorNum,
//           save_status: current.save_status,
//           save_status_lastSeen: current.save_status_lastSeen,
//         },
//       })
//     }

//     // 값이 다르면 save_status와 save_status_lastSeen 갱신
//     const now = new Date()
//     const updated = await AngleNode.findOneAndUpdate(
//       { doorNum },
//       { $set: { save_status, save_status_lastSeen: now } },
//       { new: true }
//     )

//     return res.json({
//       ok: true,
//       message: `doorNum=${doorNum} save_status가 ${save_status}로 변경되었습니다.`,
//       data: {
//         doorNum: updated.doorNum,
//         save_status: updated.save_status,
//         save_status_lastSeen: updated.save_status_lastSeen,
//       },
//     })
//   } catch (err) {
//     return res.status(500).json({ ok: false, message: err.message })
//   }
// })

// // [배치] 여러 doorNum의 save_status 일괄 변경(+ 변경된 항목만 시각 기록)
// // PATCH /api/angle-nodes/save-status
// // body: { "doorNums": [47,48,...], "save_status": true|false }
// router.patch('/save-status', async (req, res) => {
//   try {
//     const { doorNums, save_status } = req.body

//     if (!Array.isArray(doorNums) || doorNums.length === 0) {
//       return res.status(400).json({ ok: false, message: 'doorNums 배열이 필요합니다.' })
//     }
//     if (typeof save_status !== 'boolean') {
//       return res.status(400).json({ ok: false, message: 'save_status(boolean) 값이 필요합니다.' })
//     }

//     const now = new Date()

//     // 현재 값과 다른 문서만 갱신
//     const filter = { doorNum: { $in: doorNums.map(Number) }, save_status: { $ne: save_status } }
//     const update = { $set: { save_status, save_status_lastSeen: now } }

//     const result = await AngleNode.updateMany(filter, update)

//     return res.json({
//       ok: true,
//       message: `요청 ${doorNums.length}개 중 ${result.matchedCount}개 매칭, ${result.modifiedCount}개 변경.`,
//       data: {
//         matchedCount: result.matchedCount,
//         modifiedCount: result.modifiedCount,
//         save_status: save_status,
//         save_status_lastSeen: now,
//       },
//     })
//   } catch (err) {
//     return res.status(500).json({ ok: false, message: err.message })
//   }
// })

// module.exports = router
