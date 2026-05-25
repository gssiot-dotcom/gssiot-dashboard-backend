const { logger, logError } = require('../../../lib/logger')
const NodeService = require('./node.mqtt.service')
const GatewayServie = require('../../gateways/gateway.service')

// controller 객체 생성
let doorNodeController = module.exports

doorNodeController.createNodes = async (req, res) => {
	try {
		logger('request: createNode')
		const nodes = req.body

		// 🔍 요청 데이터가 배열인지 검증
		if (!Array.isArray(nodes)) {
			return res.status(400).json({
				state: 'Failed',
				message: 'Invalid data format. Expected an array.',
			})
		}

		const createdNodes = await NodeService.createNodesData(nodes)

		// 생성된 노드 개수와 함께 응답
		res.json({
			state: 'succcess',
			message: `${createdNodes.length} nodes created successfully!`,
			nodes: createdNodes,
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

doorNodeController.getNodes = async (req, res) => {
	try {
		logger('request: getNodes')

		// 전체 노드 조회
		const nodes = await NodeService.getNodesData()

		res.json({ state: 'succcess', nodes: nodes })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'Fail', message: error.message })
	}
}

doorNodeController.getAllTypeActiveNodes = async (req, res) => {
	try {
		logger('request: getNodes')

		// 활성 노드 조회
		const nodes = await NodeService.getAllTypeActiveNodesData()

		res.json({ state: 'succcess', nodes: nodes })
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/nodes/history/download?buildingId=...
 * 빌딩 ID 기준으로, 해당 빌딩에 연결된 게이트웨이들의 Door-Node 히스토리를
 * 엑셀 파일(xlsx)로 만들어 다운로드 시켜 주는 컨트롤러입니다.
 * - NodeService.downloadNodeHistoryData 가 buffer 를 생성해 줍니다.
 */
doorNodeController.downloadNodeHistory = async (req, res) => {
	try {
		logger('request: downloadNodeHistory')
		const { buildingId } = req.query

		// 엑셀 버퍼 생성 (노드별 문열림 횟수/마지막 시간 등 포함)
		const buffer = await NodeService.downloadNodeHistoryData(buildingId)

		// 다운로드용 헤더 설정
		res.setHeader(
			'Content-Disposition',
			'attachment; filename="building-nodes-history.xlsx"',
		)
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		)

		res.status(200).send(buffer)
	} catch (error) {
		console.error('Error generating Excel:', error)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/products/status
 * 노드 또는 게이트웨이의 상태(on/off)를 토글하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: node_status 를 반전
 * - GATEWAY: gateway_status 를 반전
 */
doorNodeController.updateNodeStatus = async (req, res) => {
	try {
		logger('POST: reActivateNode')
		const { product_type, product_id } = req.body

		if (product_type === 'NODE') {
			// 노드 활성/비활성 상태 토글
			const result = await NodeService.updateNodeStatusData(product_id)
			return res.json({
				state: 'success',
				updated_node: result,
			})
		}
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/products/delete
 * 노드 또는 게이트웨이를 삭제하는 컨트롤러입니다.
 * - body: { product_type: 'NODE' | 'GATEWAY', product_id: ObjectId }
 * - NODE: 노드 단건 삭제
 * - GATEWAY: 게이트웨이 삭제 + 포함된 노드 node_status true 로 복구
 */
doorNodeController.deleteNode = async (req, res) => {
	try {
		logger('POST: deleteProduct')
		const { product_type, product_id } = req.query

		if (product_type === 'NODE') {
			// 노드 삭제
			const result = await NodeService.deleteNodeData(product_id)
			return res.json({
				state: 'success',
				deleted: result,
			})
		}

		// 타입이 잘못된 경우
		return res.json({
			state: 'fail',
			message: 'undefined product type.',
		})
	} catch (error) {
		logger('ERROR: update all nodes', error)
		res.status(500).json({ state: 'Fail', message: error.message })
	}
}

/**
 * POST /api/nodes/positions
 * 노드들의 위치(position)를 직접 JSON으로 전달 받아 일괄 업데이트하는 컨트롤러입니다.
 * - body: [{ nodeNum, position }, ...]
 * - (엑셀 업로드 없이) API만으로 위치를 업데이트할 때 사용
 */
doorNodeController.setNodesPosition = async (req, res) => {
	try {
		logger('POST: setNodesPosition')
		const data = req.body

		// (필요 시) 데이터 유효성 검사를 추가로 할 수 있는 부분

		const result = await NodeService.setNodesPositionData(data)

		// 서비스에서 실패 상태(state: 'fail')를 넘겨준 경우 그대로 리턴
		if (result.state === 'fail') {
			return res.json(result)
		}

		// 성공 메시지 응답
		res.json({ state: 'success', message: result.message })
	} catch (error) {
		logger('Error on setNodesPosition', error.message)
		res.status(500).json({ state: 'fail', error: error.message })
	}
}

/**
 * POST /api/nodes/positions/upload
 * 노드 위치 정보가 포함된 엑셀 파일(.xlsx/.xls)을 업로드하고,
 * 파일 내부의 nodeNum/position 데이터로 Node.position 을 업데이트하는 컨트롤러입니다.
 * - body: { buildingId, nodesPosition: '[{nodeNum,position},...]' }
 * - file: req.files.file (업로드된 엑셀 파일)
 * - NodeService.setNodesPositionData 가 파일 저장 및 Building.nodes_position_file 갱신까지 수행
 */
doorNodeController.uploadXlsFile = async (req, res) => {
	try {
		logger('request: uploadXlsFile')
		const { buildingId, nodesPosition } = req.body

		// 업로드 파일 존재 여부 확인
		if (!req.files || !req.files.file) {
			return res.status(400).json({ error: 'Fayl tanlanmagan' })
		}

		// 문자열로 온 JSON 파싱
		const nodesPositionArrParsed = JSON.parse(nodesPosition)

		// 각 항목에 nodeNum, position 필수 값이 있는지 검증
		for (const item of nodesPositionArrParsed) {
			if (!item.nodeNum || !item.position) {
				return res.json({
					error: 'Fail',
					message:
						'No matching data structure, please check uploading file data structure!',
				})
			}
		}

		// 업로드 파일 객체 (여러 개 들어온 경우 첫 번째로 사용)
		const file = Array.isArray(req.files.file)
			? req.files.file[0]
			: req.files.file

		// 위치 업데이트 + 빌딩에 파일명 저장까지 처리
		const result = await NodeService.setNodesPositionData(
			nodesPositionArrParsed,
			buildingId,
			file,
		)

		if (result.state == 'fail') {
			return res.json(result)
		}

		res.json({ state: 'success', message: result.message })
	} catch (error) {
		console.error(error)
		res.json({ error: 'Serverda xatolik yuz berdi', error: error })
	}
}

/**
 * PATCH /api/nodes/position
 * 특정 노드의 위치 정보를 수정합니다.
 * - body: { doorNum: Number, position: String }
 */
doorNodeController.updateSingleNodePosition = async (req, res) => {
	try {
		logger('PATCH: updateSingleNodePosition')
		const { doorNum, position } = req.body

		if (!doorNum) {
			return res.status(400).json({ state: 'fail', message: 'doorNum is required' })
		}

		// Service 호출 (아래 3번 단계에서 생성)
		const result = await NodeService.updateNodePositionData(doorNum, position)

		res.json({
			state: 'success',
			message: 'Position updated successfully',
			node: result
		})
	} catch (error) {
		logError(error.message)
		res.status(500).json({ state: 'fail', message: error.message })
	}
}

/**
 * POST /api/products/combine-nodes
 * 기존 게이트웨이에 일반 Node 들을 연결하는 컨트롤러입니다.
 * - body: { gateway_id, nodes:[ObjectId,...] }
 * - 내부에서 MQTT publish 까지 수행됩니다.
 */
doorNodeController.combineNodesToGateway = async (req, res) => {
	try {
		logger('request: combineNodesToGateway:')
		const data = req.body

		await GatewayServie.combineNodesToGatewayData(data)

		res.json({
			state: 'succcess',
			message: '노드가 게이트웨이에 할당되었습니다',
		})
	} catch (error) {
		logError(error.message)
		res.json({ state: 'fail', message: error.message })
	}
}

/**
 * GET /api/nodes/report/detail?buildingId=...
 * 노드별로 '언제 열렸고 언제 닫혔는지'에 대한 상세 로그를 엑셀로 추출
 */
doorNodeController.downloadDetailedReport = async (req, res) => {
	try {
		logger('request: downloadDetailedReport');
		const { buildingId, startDate, endDate } = req.query; // 쿼리에서 날짜 추출

		// 날짜 인자 추가 전달
		const buffer = await NodeService.downloadDetailedNodeLogData(buildingId, startDate, endDate);

		// 파일명에 날짜를 포함
		const fileName = startDate && endDate
			? `Node_report_${startDate}_to_${endDate}.xlsx`
			: `node-detail-report.xlsx`;

		res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

		res.status(200).send(buffer);
	} catch (error) {
		logError(error.message);
		res.status(500).json({ state: 'fail', message: error.message });
	}
}