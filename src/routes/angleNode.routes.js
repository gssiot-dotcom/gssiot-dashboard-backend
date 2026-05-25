// // routes/angleNode.routes.js
// const express = require('express')
// const router = express.Router()

// // ⚠️ 경로는 프로젝트 구조에 맞춰 조정하세요.
// // 예: '../schema/Angle.node.model' 또는 '../models/Angle.node.model'
// const AngleNode = require('../schema/Angle.node.model')
// const AngleNodeService = require('../services/angleNode.service')

// const mongoose = require('mongoose') // ✅ 추가
// const Gateway = require('../schema/Gateway.model') // ✅ 추가 (경로 맞춰서)

// // ✅ 공통: 정수 도어번호 파싱
// function toDoorNum(v) {
// 	const n = Number(v)
// 	if (!Number.isFinite(n)) return null
// 	return Math.trunc(n)
// }

// /**
//  * GET /api/angle-nodes/alive
//  * 전체/필터 기준 node_alive 목록 조회
//  *   - 쿼리:
//  *       gateway_id: 특정 게이트웨이 ObjectId 필터 (옵션)
//  *       alive: true|false (옵션, 생존 여부 필터)
//  *       doorNums: "1,2,3" (옵션, 특정 도어번호들만)
//  *   - 응답: [{ doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }]
//  */
// router.get('/alive', async (req, res) => {
// 	try {
// 		const { gateway_id, alive, doorNums } = req.query
// 		const q = {}

// 		if (gateway_id) q.gateway_id = gateway_id
// 		if (alive === 'true') q.node_alive = true
// 		if (alive === 'false') q.node_alive = false

// 		if (doorNums) {
// 			const list = String(doorNums)
// 				.split(',')
// 				.map(s => toDoorNum(s.trim()))
// 				.filter(n => n !== null)
// 			if (list.length > 0) q.doorNum = { $in: list }
// 		}

// 		const rows = await AngleNode.find(q)
// 			.select(
// 				'doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen'
// 			)
// 			.sort({ doorNum: 1 })
// 			.lean()

// 		// save_status가 없는 문서는 기본 true로 보이도록 정규화
// 		const normalized = rows.map(r => ({
// 			...r,
// 			save_status: r.save_status === undefined ? true : r.save_status,
// 		}))

// 		res.json(normalized)
// 	} catch (err) {
// 		console.error(err)
// 		res.status(500).json({ message: 'Failed to fetch node_alive list' })
// 	}
// })

// /**
//  * PUT /api/angle-nodes/position
//  * body 형식:
//  *  - 단일: { "doorNum": 10, "position": "B-2구간-7층" }
//  *  - 여러 개: [ { doorNum: 10, position: "..." }, { doorNum: 11, position: "..." } ]
//  */
// router.put('/position', async (req, res) => {
// 	try {
// 		const body = req.body

// 		// 배열인지 단일 객체인지에 따라 분기
// 		if (Array.isArray(body)) {
// 			const updated = await AngleNodeService.setAngleNodePositions(body)
// 			return res.status(200).json({
// 				state: 'success',
// 				count: updated.length,
// 				angle_nodes: updated,
// 			})
// 		} else {
// 			const { doorNum, position } = body
// 			if (doorNum === undefined || position === undefined) {
// 				return res.status(400).json({
// 					state: 'fail',
// 					message: 'doorNum and position are required',
// 				})
// 			}

// 			const updated = await AngleNodeService.setAngleNodePosition(
// 				doorNum,
// 				position
// 			)

// 			return res.status(200).json({
// 				state: 'success',
// 				angle_node: updated,
// 			})
// 		}
// 	} catch (error) {
// 		console.error('Error on setting angle-node position:', error.message)
// 		return res.status(500).json({
// 			state: 'fail',
// 			message: error.message,
// 		})
// 	}
// })

// /**
//  * GET /api/angle-nodes/:doorNum/alive
//  * 단일 도어번호의 node_alive 상태 조회
//  *   - 응답: { doorNum, node_alive, lastSeen, updatedAt, save_status, save_status_lastSeen }
//  */
// router.get('/:doorNum/alive', async (req, res) => {
// 	try {
// 		const doorNum = toDoorNum(req.params.doorNum)
// 		if (doorNum === null) {
// 			return res.status(400).json({ message: 'Invalid doorNum' })
// 		}

// 		const doc = await AngleNode.findOne({ doorNum })
// 			.select(
// 				'doorNum node_alive lastSeen updatedAt save_status save_status_lastSeen'
// 			)
// 			.lean()

// 		if (!doc) {
// 			return res.status(404).json({ message: 'Angle node not found' })
// 		}

// 		// save_status가 없는 문서는 기본 true로 보이도록 정규화
// 		const normalized = {
// 			...doc,
// 			save_status: doc.save_status === undefined ? true : doc.save_status,
// 		}

// 		res.json(normalized)
// 	} catch (err) {
// 		console.error(err)
// 		res.status(500).json({ message: 'Failed to fetch node_alive' })
// 	}
// })

// /**
//  * PATCH /api/angle-nodes/:doorNum/gateway
//  * body: { "gateway_id": "ObjectId or null" }
//  */
// router.patch('/:doorNum/gateway', async (req, res) => {
// 	try {
// 		const doorNum = toDoorNum(req.params.doorNum)
// 		if (doorNum === null) {
// 			return res.status(400).json({
// 				state: 'fail',
// 				message: 'Invalid doorNum',
// 			})
// 		}

// 		const { gateway_id } = req.body

// 		// gateway_id 필수 (단 null은 허용: "할당 해제")
// 		if (gateway_id === undefined) {
// 			return res.status(400).json({
// 				state: 'fail',
// 				message: 'gateway_id is required (can be null)',
// 			})
// 		}

// 		// ✅ 5-1) ObjectId 형식 검증
// 		if (gateway_id !== null && !mongoose.Types.ObjectId.isValid(gateway_id)) {
// 			return res.status(400).json({
// 				state: 'fail',
// 				message: 'Invalid gateway_id',
// 			})
// 		}

// 		// ✅ 5-2) Gateway 실제 존재 검증
// 		if (gateway_id !== null) {
// 			const gw = await Gateway.findById(gateway_id).lean()
// 			if (!gw) {
// 				return res.status(404).json({
// 					state: 'fail',
// 					message: 'Gateway not found',
// 				})
// 			}
// 		}

// 		const updated = await AngleNode.findOneAndUpdate(
// 			{ doorNum },
// 			{ gateway_id },
// 			{ new: true }
// 		)
// 			.select('doorNum gateway_id node_status node_alive lastSeen updatedAt')
// 			.lean()

// 		if (!updated) {
// 			return res.status(404).json({
// 				state: 'fail',
// 				message: 'Angle node not found',
// 			})
// 		}

// 		return res.status(200).json({
// 			state: 'success',
// 			angle_node: updated,
// 		})
// 	} catch (err) {
// 		console.error(err)
// 		return res.status(500).json({
// 			state: 'fail',
// 			message: err.message,
// 		})
// 	}
// })

// module.exports = router
