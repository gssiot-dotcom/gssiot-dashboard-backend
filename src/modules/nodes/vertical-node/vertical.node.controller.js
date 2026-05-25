const { VerticalNodeService } = require('./vertical.node.service')
const { logger, logError } = require('../../../lib/logger')
const { VerticalNode, VerticalNodeHistory } = require('./Vertical.node.model')
const GatewayServie = require('../../gateways/gateway.service')

// controller 객체 생성
let verticalNodeController = module.exports

verticalNodeController.createVerticalNodes = async (req, res) => {
	try {
		logger('request: createVerticalNodes')
		const verticalNodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(verticalNodes)) {
			return res.status(400).json({
				state: 'fail',
				message: 'Invalid data format. Expected an array.',
			})
		}

		const verticalNodeService = new VerticalNodeService()

		// Vertical-Node 생성 (중복 doorNum 체크)
		const createdNodes =
			await verticalNodeService.createVerticalNodesData(verticalNodes)

		res.json({
			state: 'success',
			message: `${createdNodes.length} vertical nodes created successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.getVerticalNodesByGatewayId = async (req, res) => {
	try {
		logger('request: getVerticalNodesByGatewayId')
		const { gatewayId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Gateway ID로 Vertical Nodes 조회
		const verticalNodes =
			await verticalNodeService.getVerticalNodesByGatewayId(gatewayId)

		res.json({
			state: 'success',
			data: verticalNodes,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.getVerticalNodes = async (req, res) => {
	try {
		logger('request: getVerticalNodes')

		const verticalNodeService = new VerticalNodeService()

		// 모든 Vertical Nodes 조회
		const verticalNodes = await verticalNodeService.getVerticalNodes()

		res.json({
			state: 'success',
			data: verticalNodes,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.deleteVerticalNodeById = async (req, res) => {
	try {
		logger('request: deleteVerticalNodeById')
		const { verticalNodeId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Vertical Node 삭제
		await verticalNodeService.deleteVerticalNodeById(verticalNodeId)

		res.json({
			state: 'success',
			message: `Vertical node ${verticalNodeId} deleted successfully!`,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.updateVerticalNodeStatus = async (req, res) => {
	try {
		logger('request: updateVerticalNodeStatus')
		const { verticalNodeId } = req.params

		const verticalNodeService = new VerticalNodeService()

		// Vertical Node 상태 업데이트
		const updatedNode =
			await verticalNodeService.updateVerticalNodeStatus(verticalNodeId)

		res.json({
			state: 'success',
			data: updatedNode,
		})
	} catch (error) {
		logError(error.message)
		res.status(400).json({ state: 'fail', message: error.message })
	}
}

verticalNodeController.combineVerticalNodesToGateway = async (req, res) => {
	try {
		logger('request: combineVerticalNodesToGateway:')
		const data = req.body

		await GatewayServie.combineVerticalNodesToGateway(data)

		res.json({
			state: 'succcess',
			message: '수직 노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

// ===================== Vertical Node graphic endpoints ===================
/**
 * GET /api/angle-nodes/graphic?doorNum=10&from=2025-01-01&to=2025-01-02
 * 특정 비계전도 노드(doorNum)의 각도 히스토리를 그래프용으로 리턴하는 컨트롤러입니다.
 * - AngleNodeHistory 컬렉션에서 doorNum 및 createdAt 범위로 조회 후 시간순 정렬
 * - 응답: [{ doorNum, angle_x, angle_y, position, createdAt, ... }, ...]
 * 프론트에서 이 데이터를 사용하여 차트(그래프)를 그릴 수 있습니다.
 */
verticalNodeController.verticalNodeGraphicData = async (req, res) => {
	logger('request: verticalNodeGraphicData')

	try {
		const { doorNum, from, to } = req.query

		// 필수 쿼리 파라미터 확인
		if (!doorNum || !from || !to) {
			return res.status(400).json({ message: 'doorNum, from, to required' })
		}

		// AngleNodeHistory 에서 doorNum + 기간 조건으로 조회
		const data = await VerticalNodeHistory.find({
			node_number: parseInt(doorNum),
			createdAt: {
				$gte: new Date(from),
				$lte: new Date(to),
			},
		}).sort({ createdAt: 1 }) // 시간순 정렬(오름차순)

		res.json(data)
	} catch (err) {
		console.error('Error fetching verticalNodeGraphicData:', err)
		res.status(500).json({ message: 'Server error' })
	}
}

// 위치 정보 업데이트
verticalNodeController.updateLocation = async (req, res) => {
	try {
		const { node_number } = req.params
		const { position, floor } = req.body

		const verticalNodeService = new VerticalNodeService()
		const updatedNode = await verticalNodeService.updateLocation(
			node_number,
			position,
			floor,
		)

		res.status(200).json({ success: true, data: updatedNode })
	} catch (error) {
		console.error('updateLocation error:', error)
		if (error.message.includes('Not Found')) {
			return res.status(404).json({ success: false, message: 'Not Found' })
		}
		res.status(500).json({ success: false, error: error.message })
	}
}