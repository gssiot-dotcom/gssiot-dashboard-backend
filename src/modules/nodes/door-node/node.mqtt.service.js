const { Node, NodesHistory } = require('../../nodes/door-node/node.model')
const BuildingSchema = require('../../building/building.model')
const GatewaySchema = require('../../gateways/gateway.model')
const { eventBus } = require('../../../shared/eventBus')
const { logger, logError, logInfo } = require('../../../lib/logger')
const fileService = require('../../../services/file.service')
const { AngleNode } = require('../angle-node/angleNode.model')
const { VerticalNode } = require('../vertical-node/Vertical.node.model')

const ExcelJS = require('exceljs')
const NodeSchema = require('../node.model')

async function handleNodeMqttMessage({ data, gatewayNumberLast4 }) {
	const now = new Date()
	const timeString = now.toLocaleString('ko-KR', {
		timeZone: 'Asia/Seoul',
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})

	logger('Door-Node mqtt message:', data, '|', timeString)

	if (data.doorNum == null || data.doorChk == null) {
		logError('handleNodeMqttMessage: missing required fields', data)
		return
	}

	const gateway = await GatewaySchema.findOne({
		serialNumber: { $regex: `${gatewayNumberLast4}$` },
	}).lean()

	if (!gateway) {
		logError('handleNodeMqttMessage: gateway not found', gatewayNumberLast4)
		return
	}

	const doorState = Number(data.doorChk)
	const saveStatus = doorState === 1 ? 'danger' : 'safe'

	const eventData = {
		gwNumber: gateway.serialNumber,
		nodeNumber: data.doorNum,
		doorState,
		batteryLevel: data.betChk,
	}

	const updateData = {
		doorState,
		status: saveStatus,
		batteryLevel: data.betChk,
		lastSeenAt: new Date(),
		...(data.betChk_2 !== undefined && { betChk_2: data.betChk_2 }),
	}

	const updatedNode = await NodeSchema.findOneAndUpdate(
		{
			gatewayId: gateway._id,
			number: data.doorNum,
		},
		{
			$set: updateData,
		},
		{
			new: true,
		},
	)

	if (!updatedNode) {
		logInfo('Door node not found:', {
			gatewayNumberLast4,
			doorNum: data.doorNum,
		})
		return
	}

	try {
		await NodesHistory.create(eventData)
	} catch (err) {
		logError('NodesHistory 저장 오류:', err.message)
		return
	}

	if (gateway.buildingId) {
		eventBus.emit('rt.node', {
			buildingId: gateway.buildingId.toString(),
			nodeId: updatedNode._id,
			nodeNumber: updatedNode.number,
			doorState: updatedNode.doorState,
			batteryLevel: updatedNode.batteryLevel,
			status: updatedNode.status,
			updatedAt: updatedNode.updatedAt,
		})
	}

	logger('handleNodeMqttMessage: door node updated', {
		nodeId: updatedNode._id,
		doorState,
		status: saveStatus,
	})
}

/**
 * 해치발판 Node 여러 개를 한 번에 생성하는 서비스
 * @param {Array} arrayData - [{ doorNum, ... }, ...]
 * 1. doorNum 기준으로 기존 노드 중복 여부 확인
 * 2. 중복 있으면 에러 throw
 * 3. insertMany 로 한 번에 노드 생성
 */
async function createNodesData(arrayData) {
	try {
		// 이미 존재하는 doorNum 이 있는지 확인
		const existNodes = await Node.find({
			doorNum: { $in: arrayData.map(data => data.doorNum) },
		})
		if (existNodes.length > 0) {
			const existNodeNums = existNodes.map(node => node.doorNum)
			throw new Error(
				`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`,
			)
		}

		// 중복이 없으면 그대로 삽입
		const result = await Node.insertMany(arrayData)
		return result
	} catch (error) {
		throw new Error(`Error: ${error.message}`)
	}
}

/**
 * 모든 Node 조회
 */
async function getNodesData() {
	try {
		const nodes = await Node.find()
		if (!nodes || nodes.length == 0) {
			throw new Error('There is no any nodes in database :(')
		}
		return nodes
	} catch (error) {
		throw error
	}
}

/**
 * node_status = true 인 활성 Node 들만 조회
 * - 없으면 빈 배열 반환
 */
async function getAllTypeActiveNodesData() {
	try {
		const door_nodes = await Node.find({ node_status: true })
		const angle_nodes = await AngleNode.find({ node_status: true })
		const vertical_nodes = await VerticalNode.find({ node_status: true })
		if (!door_nodes || !angle_nodes.length || !vertical_nodes) {
			return []
		}
		const result = {
			nodes: door_nodes,
			angle_nodes,
			vertical_nodes,
		}
		return result
	} catch (error) {
		throw error
	}
}

/**
 * 단일 노드 위치 업데이트
 * @param {Number} doorNum
 * @param {String} position
 */
async function updateNodePositionData(doorNum, position) {
	try {
		const updatedNode = await Node.findOneAndUpdate(
			{ doorNum: doorNum },
			{ $set: { position: position } },
			{ new: true }, // 업데이트된 결과 객체 반환
		)

		if (!updatedNode) {
			throw new Error('해당 번호의 노드를 찾을 수 없습니다.')
		}

		return updatedNode
	} catch (error) {
		throw error
	}
}

// module.exports에 추가 잊지 마세요!
module.exports = {
	// ... 기존 export 항목들
	updateNodePositionData,
}
/**
 * 빌딩 ID 기준으로 노드 히스토리 통계를 내고, 엑셀 파일 버퍼를 생성
 * Flow:
 *  1. Building 조회 → gateway_sets 에 포함된 게이트웨이들의 serial_number 추출
 *  2. NodeHistory 에서 gw_number ∈ serialNumbers 인 기록 모두 조회
 *  3. doorNum 별로 doorChk=1 인 횟수와 마지막 열린 시간 집계
 *  4. 집계 결과 배열(result)을 createExcelFile 에 전달하여 ExcelJS 버퍼 생성
 */
async function downloadNodeHistoryData(buildingId) {
	try {
		// 빌딩 정보 조회 (어떤 게이트웨이들이 연결되어 있는지 확인)
		const building = await BuildingSchema.findById(buildingId)

		// 빌딩에 연결된 게이트웨이들의 serial_number 추출
		const buildingGateways = await GatewaySchema.find(
			{
				_id: { $in: building.gateway_sets },
			},
			{ serial_number: 1, _id: 0 },
		)

		const serialNumbers = buildingGateways.map(gateway => gateway.serial_number)

		// 해당 게이트웨이들에서 발생한 NodeHistory 전체 조회
		const history = await NodesHistory.find({
			gw_number: { $in: serialNumbers },
		})

		// 히스토리가 하나도 없으면 에러
		if (!history || history.length === 0) {
			throw new Error('History is not found')
		}

		// doorNum 기준 문 열림 횟수 및 마지막 열린 시간 집계
		const doorStats = {} // { doorNum: { doorOpen_count, gw_number, last_open } }

		history.forEach(entry => {
			if (entry.doorChk === 1) {
				if (!doorStats[entry.doorNum]) {
					// 첫 등장일 경우
					doorStats[entry.doorNum] = {
						doorOpen_count: 1,
						gw_number: entry.gw_number,
						last_open: entry.createdAt,
					}
				} else {
					doorStats[entry.doorNum].doorOpen_count++
					// 마지막 열린 시간 최신값으로 갱신
					if (
						new Date(entry.createdAt) >
						new Date(doorStats[entry.doorNum].last_open)
					) {
						doorStats[entry.doorNum].last_open = entry.createdAt
					}
				}
			}
		})

		// doorStats 오브젝트를 배열 형태로 변환
		const result = Object.entries(doorStats).map(([doorNum, data]) => {
			const lastOpenDate =
				typeof data.last_open === 'string'
					? data.last_open
					: new Date(data.last_open).toISOString()

			return {
				doorNum: Number(doorNum),
				doorOpen_count: data.doorOpen_count,
				gw_number: data.gw_number,
				last_open: lastOpenDate.substring(0, 10), // YYYY-MM-DD
			}
		})

		// ExcelJS 를 사용하여 엑셀 버퍼 생성
		const buffer = await this.createExcelFile(result)
		return buffer
	} catch (error) {
		console.error('Error generating Excel:', error)
		throw error
	}
}

/**
 * 노드 상태 토글 (node_status true ↔ false)
 * @param {String} nodeId
 */
async function updateNodeStatusData(nodeId) {
	try {
		// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
		const updatingNode = await Node.findOneAndUpdate(
			{ _id: nodeId },
			[{ $set: { node_status: { $not: '$node_status' } } }],
			{ new: true }, // 변경 후 도큐먼트를 반환
		)

		if (!updatingNode) {
			throw new Error('Node not found')
		}

		return updatingNode
	} catch (error) {
		throw error
	}
}

/**
 * 노드 삭제
 * @param {String} nodeId
 */
async function deleteNodeData(nodeId) {
	try {
		const deletingNode = await Node.findOneAndDelete({
			_id: nodeId,
		})
		if (!deletingNode) {
			throw new Error('Node not found')
		}

		return deletingNode
	} catch (error) {
		console.error('Error deleting node:', error)
		throw error
	}
}

/**
 * 단일 노드 위치 업데이트
 * @param {Number} doorNum
 * @param {String} position
 */
async function updateNodePositionData(doorNum, position) {
	try {
		const updatedNode = await Node.findOneAndUpdate(
			{ doorNum: doorNum },
			{ $set: { position: position } },
			{ new: true }, // 업데이트된 결과 객체 반환
		)

		if (!updatedNode) {
			throw new Error('해당 번호의 노드를 찾을 수 없습니다.')
		}

		return updatedNode
	} catch (error) {
		throw error
	}
}

/**
 * Node.position 을 doorNum 기준으로 일괄 업데이트 + 빌딩에 엑셀 파일명 저장
 * @param {Array} nodesPosition - [{ nodeNum, position }, ...]
 * @param {String} buildingId
 * @param {Object} file - 업로드된 엑셀 파일 객체 (multer 등)
 * Flow:
 *  1. nodesPosition 을 순회하며 doorNum 기준 updateMany 로 position 업데이트
 *  2. 매칭된 Node 가 없는 doorNum 은 모아서 fail 메시지 리턴
 *  3. 파일을 /exels 폴더에 저장(fileService.save)
 *  4. 기존에 있던 nodes_position_file 이 있으면 삭제(fileService.delete)
 *  5. Building.nodes_position_file 에 새 파일명 저장
 */
async function setNodesPositionData(nodesPosition, buildingId, file) {
	try {
		// 각 노드에 대한 position 업데이트
		const updatePromises = nodesPosition.map(async item => {
			const result = await Node.updateMany(
				{ doorNum: item.nodeNum },
				{ $set: { position: item.position } },
			)
			return {
				doorNum: item.nodeNum,
				matchedCount: result.matchedCount,
				modifiedCount: result.modifiedCount,
			}
		})

		const results = await Promise.all(updatePromises)

		// 매칭된 Node 가 하나도 없는 doorNum 목록
		const noUpdates = results
			.filter(res => res.matchedCount === 0)
			.map(res => res.doorNum)

		if (noUpdates.length > 0) {
			return {
				state: 'fail',
				message: `${noUpdates} 번 노드가 발견되지 않았습니다. 파일을 확인하세요!`,
			}
		}

		// 파일 저장 (예: static/exels 폴더 등)
		const fileName = fileService.save(file, 'exels')

		// 빌딩 정보 조회 후 기존 파일 삭제 + 새 파일명 저장
		const building = await BuildingSchema.findById(buildingId)
		if (building) {
			const oldFilename = building.nodes_position_file

			if (oldFilename && oldFilename.trim() !== '') {
				fileService.delete(oldFilename)
			}

			await this.buildingSchema.findByIdAndUpdate(
				buildingId,
				{ nodes_position_file: fileName },
				{ new: true },
			)
		}

		return {
			message: `${nodesPosition.length}개 노드가 성공적으로 배치되었습니다.`,
		}
	} catch (error) {
		console.error('Error on node positioning:', error)
		throw new Error('Error on node positioning.')
	}
}

/**
 * 특정 빌딩 + 특정 기간의 노드 상세 열림/닫힘 로그 생성 (타임존 보정 및 보고서 형식)
 * @param {String} buildingId - 빌딩의 MongoDB ObjectId
 * @param {String} startDate - '2026-04-01' (KST 기준 시작일)
 * @param {String} endDate   - '2026-04-08' (KST 기준 종료일)
 */
/**
 * 특정 빌딩 + 특정 기간의 노드 상세 로그 생성 (건물명 컬럼 추가 버전)
 */
async function downloadDetailedNodeLogData(buildingId, startDate, endDate) {
	try {
		// 1. 빌딩 정보 조회 (이름 포함)
		const building = await BuildingSchema.findById(buildingId)
		if (!building) throw new Error('Building not found')

		// DB 컬럼명이 building_name인지 확인 필요 (보통 building.name 또는 building.building_name)
		const bName = building.building_name || building.name || '알 수 없음'

		const buildingGateways = await GatewaySchema.find(
			{ _id: { $in: building.gateway_sets } },
			{ serial_number: 1, _id: 0 },
		)
		const serialNumbers = buildingGateways.map(gw => gw.serial_number)

		// 2. 노드 위치 매핑
		const allNodes = await Node.find({
			gateway_id: { $in: building.gateway_sets },
		})
		const nodeMap = {}
		allNodes.forEach(n => {
			nodeMap[n.doorNum] = n.position || '위치 미지정'
		})

		// 3. 날짜 필터 설정
		const dateFilter = {
			gw_number: { $in: serialNumbers },
		}

		if (startDate || endDate) {
			dateFilter.createdAt = {}
			if (startDate) {
				const s = startDate.split('-').map(Number)
				dateFilter.createdAt.$gte = new Date(s[0], s[1] - 1, s[2], 0, 0, 0, 0)
			}
			if (endDate) {
				const e = endDate.split('-').map(Number)
				dateFilter.createdAt.$lte = new Date(
					e[0],
					e[1] - 1,
					e[2],
					23,
					59,
					59,
					999,
				)
			}
		}

		const history = await NodesHistory.find(dateFilter).sort({ createdAt: 1 })
		const reportData = []
		const activeSessions = {}
		let totalOpenCount = 0

		// 4. 데이터 가공 (건물명 추가)
		history.forEach(entry => {
			const nodeKey = entry.doorNum

			if (entry.doorChk === 1) {
				activeSessions[nodeKey] = entry.createdAt
				totalOpenCount++
			} else if (entry.doorChk === 0 && activeSessions[nodeKey]) {
				const startTime = activeSessions[nodeKey]
				const endTime = entry.createdAt
				const durationMs = new Date(endTime) - new Date(startTime)

				reportData.push({
					건물명: bName, // 요청하신 건물명 컬럼 추가
					'노드 번호': nodeKey,
					'설치 위치': nodeMap[nodeKey] || '알 수 없음',
					게이트웨이: entry.gw_number,
					상태: '정상 종료',
					'열림 시각': new Date(startTime).toLocaleString('ko-KR'),
					'닫힘 시각': new Date(endTime).toLocaleString('ko-KR'),
					'지속 시간': `${(durationMs / 1000).toFixed(1)}초`,
				})

				delete activeSessions[nodeKey]
			}
		})

		// 아직 열려있는 노드 처리
		Object.keys(activeSessions).forEach(nodeKey => {
			reportData.push({
				건물명: bName,
				'노드 번호': Number(nodeKey),
				'설치 위치': nodeMap[nodeKey] || '알 수 없음',
				게이트웨이: 'N/A',
				상태: '현재 열림',
				'열림 시각': new Date(activeSessions[nodeKey]).toLocaleString('ko-KR'),
				'닫힘 시각': '-',
				'지속 시간': '-',
			})
		})

		const bAddr = building.building_addr || building.address || '주소 정보 없음'

		// 5. 요약 정보 (summary 객체에 building_addr 추가)
		const summary = {
			buildingName: bName,
			building_addr: bAddr, // addr 선언
			totalNodes: allNodes.length,
			totalOpenCount: totalOpenCount,
			period: startDate && endDate ? `${startDate} ~ ${endDate}` : '전체 기간',
			reportDate: new Date().toLocaleString('ko-KR'),
		}

		return await this.createExcelFile(reportData, summary)
	} catch (error) {
		logError('보고서 생성 실패: ' + error.message)
		throw error
	}
}
/**
 * 현장 보고서 스타일의 Excel 생성
 * - 설치 노드(DB 총 수) 및 조회 데이터 통계 포함
 */
/**
 * 현장 보고서 스타일의 Excel 생성 (전체 통합 버전)
 * 구성: 타이틀/결재란 -> 기준정보 -> 통계 대시보드 -> 데이터 리스트 -> 현장 사진 -> 종합 평가/서명
 */
async function createExcelFile(data, summary) {
	const workbook = new ExcelJS.Workbook()
	const now = new Date()

	// 1. 기본 정보 및 통계 선언
	const buildingAddr = summary.building_addr || '주소 정보 없음'
	const buildingName = summary.buildingName || '현장명 미지정'

	const stats = {
		installed: summary.totalNodes || 0,
		total: data.length,
		정상: 0,
		주의: 0,
		경고: 0,
		위험: 0,
		미종료: 0,
	}

	// 데이터 가공 및 등급 계산
	const processedData = data.map(item => {
		let durationSec = 0
		let isOpening = !item['닫힘 시각'] || item['닫힘 시각'] === '-'

		if (isOpening) {
			const openTime = new Date(item['열림 시각'])
			durationSec = Math.floor((now - openTime) / 1000)
			stats.미종료++
		} else {
			durationSec = parseDurationToSeconds(item['지속 시간'])
		}

		let statusGrade = ''
		let statusIcon = ''

		if (isOpening) {
			statusGrade = '미종료'
			statusIcon = '🟣'
		} else if (durationSec < 60) {
			statusGrade = '정상'
			stats.정상++
		} else if (durationSec < 180) {
			statusGrade = '주의'
			stats.주의++
		} else if (durationSec < 300) {
			statusGrade = '경고'
			stats.경고++
		} else {
			statusGrade = '위험'
			stats.위험++
		}

		return { ...item, statusGrade, statusIcon, durationSec, isOpening }
	})

	// ---------------------------------------------------------
	// 워크시트 생성 및 인쇄 설정 (열 기준 맞춤 핵심 부분)
	// ---------------------------------------------------------
	const worksheet = workbook.addWorksheet('안전점검보고서', {
		pageSetup: {
			paperSize: 9, // A4
			orientation: 'landscape', // 가로 방향
			fitToPage: true, // 페이지 맞춤 활성화
			fitToWidth: 1, // 모든 열을 한 페이지 너비에 맞춤
			fitToHeight: 0, // 행(높이)은 데이터 양에 따라 자연스럽게 다음 페이지로 이동
			margins: {
				// 여백 최적화 (단위: inch)
				left: 0.3,
				right: 0.3,
				top: 0.3,
				bottom: 0.3,
				header: 0.2,
				footer: 0.2,
			},
			printTitlesRow: '10:10', // 페이지가 넘어가도 10행(헤더)은 매번 반복 출력
		},
	})

	// ---------------------------------------------------------
	// 2. 타이틀 및 결재란 (1~3행)
	// ---------------------------------------------------------
	for (let i = 1; i <= 3; i++) worksheet.getRow(i).height = 28

	worksheet.mergeCells('A1:H3')
	const titleCell = worksheet.getCell('A1')
	titleCell.value = '해 치 발 판 안 전 점 검 결 과 보 고 서'
	titleCell.font = { size: 22, bold: true, name: '맑은 고딕' }
	titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
	titleCell.border = { bottom: { style: 'double' } }

	const approvalCols = ['I', 'J', 'K']
	const labels = ['담 당', '검 토', '승 인']
	approvalCols.forEach((col, idx) => {
		const lCell = worksheet.getCell(`${col}1`)
		lCell.value = labels[idx]
		lCell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFF2F2F2' },
		}
		lCell.font = { bold: true, size: 10 }
		lCell.alignment = { horizontal: 'center', vertical: 'middle' }
		lCell.border = {
			top: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' },
			bottom: { style: 'thin' },
		}

		worksheet.mergeCells(`${col}2:${col}3`)
		worksheet.getCell(`${col}2`).border = {
			top: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' },
			bottom: { style: 'thin' },
		}
	})

	// ---------------------------------------------------------
	// 3. 기준 정보 표 (4~5행)
	// ---------------------------------------------------------
	worksheet.getRow(4).height = 22
	worksheet.getRow(5).height = 25

	const infoTable = [
		{ label: '작성 일시', value: summary.reportDate, startCol: 1, endCol: 3 },
		{ label: '조회 기간', value: summary.period, startCol: 4, endCol: 5 },
		{
			label: '기준 현장명',
			value: summary.buildingName,
			startCol: 6,
			endCol: 8,
		},
		{
			label: '기준지 위치',
			value: summary.building_addr,
			startCol: 9,
			endCol: 11,
		},
	]

	infoTable.forEach(info => {
		worksheet.mergeCells(4, info.startCol, 4, info.endCol)
		const lCell = worksheet.getCell(4, info.startCol)
		lCell.value = info.label
		lCell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFF2F2F2' },
		}
		lCell.font = { bold: true, size: 10 }
		lCell.alignment = { horizontal: 'center', vertical: 'middle' }
		lCell.border = {
			top: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' },
			bottom: { style: 'thin' },
		}

		worksheet.mergeCells(5, info.startCol, 5, info.endCol)
		const vCell = worksheet.getCell(5, info.startCol)
		vCell.value = info.value
		vCell.alignment = {
			horizontal: 'center',
			vertical: 'middle',
			wrapText: true,
		}
		vCell.border = {
			top: { style: 'thin' },
			left: { style: 'thin' },
			right: { style: 'thin' },
			bottom: { style: 'thin' },
		}
	})

	// ---------------------------------------------------------
	// 4. 통계 대시보드 (7~8행)
	// ---------------------------------------------------------
	const statItems = [
		{ label: '설치 노드', key: 'installed', color: '4472C4' },
		{ label: '점검 건수', key: 'total', color: '5B9BD5' },
		{ label: '위험 수준', key: '위험', color: 'C00000' },
		{ label: '경고 수준', key: '경고', color: 'ED7D31' },
		{ label: '주의/미종료', key: '미종료', color: '7030A0' },
	]

	statItems.forEach((s, i) => {
		const colIdx = i * 2 + 1
		worksheet.mergeCells(7, colIdx, 7, colIdx + 1)
		const lCell = worksheet.getCell(7, colIdx)
		lCell.value = s.label
		lCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
		lCell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: s.color },
		}
		lCell.alignment = { horizontal: 'center' }

		worksheet.mergeCells(8, colIdx, 8, colIdx + 1)
		const vCell = worksheet.getCell(8, colIdx)
		vCell.value = `${stats[s.key]} 건`
		vCell.font = { bold: true, size: 14 }
		vCell.alignment = { horizontal: 'center' }
		vCell.border = { bottom: { style: 'medium', color: { argb: s.color } } }
	})
	worksheet.getRow(8).height = 30

	// ---------------------------------------------------------
	// 5. 상세 데이터 리스트 (10행~)
	// ---------------------------------------------------------
	const headerRow = worksheet.getRow(11)
	headerRow.values = [
		'No.',
		'상태',
		'점검 위치',
		'지속 시간',
		'열림 시각',
		'닫힘 시각',
		'노드번호',
		'',
		'비고',
		'',
		'',
	]
	headerRow.height = 30
	headerRow.eachCell(c => {
		c.font = { bold: true, size: 11 }
		c.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFE0E0E0' },
		}
		c.alignment = { horizontal: 'center', vertical: 'middle' }
		c.border = { top: { style: 'medium' }, bottom: { style: 'medium' } }
	})

	processedData.forEach((item, index) => {
		const row = worksheet.addRow([
			index + 1,
			`${item.statusIcon} ${item.statusGrade}`,
			item['설치 위치'],
			item.isOpening ? `진행중` : item['지속 시간'],
			item['열림 시각'],
			item.isOpening ? '-' : item['닫힘 시각'],
			item['노드 번호'],
			'', // 비고 내용이 들어갈 시작점 (H열)
			'', // I열
			'', // J열
			'', // K열
		])
		// 현재 추가된 행의 번호를 가져옵니다.
		const currentRowNum = row.number

		// H열(8)부터 K열(11)까지 병합 (예: "H5:K5")
		worksheet.mergeCells(`H${currentRowNum}:K${currentRowNum}`)

		// 필요하다면 병합된 셀의 스타일 설정 (예: 가운데 정렬)
		row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' }
		row.height = 26
		row.eachCell((cell, colNum) => {
			cell.alignment = { horizontal: 'center', vertical: 'middle' }
			cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } }
			if (colNum === 2 && item.statusGrade === '위험') {
				cell.font = { bold: true, color: { argb: 'FFC00000' } }
			}
		})
	})

	// ---------------------------------------------------------
	// 6. 현장 사진 및 이미지 (데이터 종료 후 하단)
	// ---------------------------------------------------------
	let currentRow = 10 + processedData.length + 2
	worksheet.mergeCells(`A${currentRow}:K${currentRow}`)
	const photoTitle = worksheet.getCell(`A${currentRow}`)
	photoTitle.value = '현장 사진 및 이미지'
	photoTitle.font = { bold: true, size: 12 }
	photoTitle.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' },
	}
	currentRow++

	const photoHeaders = [
		{ label: '위험 감지 후 조치 전 현장', start: 1, end: 4 },
		{ label: '안전 조치 후 현장', start: 6, end: 10 },
	]
	photoHeaders.forEach(h => {
		worksheet.mergeCells(currentRow, h.start, currentRow, h.end)
		const cell = worksheet.getCell(currentRow, h.start)
		cell.value = h.label
		cell.alignment = { horizontal: 'center' }
		cell.font = { bold: true }
		cell.border = {
			outline: true,
			top: { style: 'thin' },
			bottom: { style: 'thin' },
		}
	})
	currentRow++

	worksheet.getRow(currentRow).height = 150
	worksheet.mergeCells(currentRow, 1, currentRow, 4)
	worksheet.mergeCells(currentRow, 6, currentRow, 10)
	worksheet.getCell(currentRow, 1).value = '\n\n(이미지 첨부)'
	worksheet.getCell(currentRow, 6).value = '\n\n(이미지 첨부)' // 기존 7열에서 6열로 수정
	;[1, 6].forEach(c => {
		worksheet.getCell(currentRow, c).alignment = {
			horizontal: 'center',
			vertical: 'middle',
		}
		worksheet.getCell(currentRow, c).border = {
			outline: true,
			left: { style: 'thin' },
			right: { style: 'thin' },
		}
	})
	currentRow++
	;['구역명', '내용'].forEach(label => {
		worksheet.getRow(currentRow).height = 25
		worksheet.getCell(currentRow, 1).value = label
		worksheet.getCell(currentRow, 1).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFF2F2F2' },
		}
		worksheet.mergeCells(currentRow, 2, currentRow, 4)

		worksheet.getCell(currentRow, 6).value = label
		worksheet.getCell(currentRow, 6).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFF2F2F2' },
		}
		worksheet.mergeCells(currentRow, 7, currentRow, 10)

		const activeCols = [1, 2, 3, 4, 6, 7, 8, 9, 10]
		activeCols.forEach(col => {
			const cell = worksheet.getCell(currentRow, col)
			cell.alignment = { horizontal: 'center', vertical: 'middle' }
			cell.border = {
				top: { style: 'thin' },
				bottom: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
			}
		})
		currentRow++
	})
	currentRow += 1

	// ---------------------------------------------------------
	// 7. 종합 평가 및 서명란
	// ---------------------------------------------------------
	worksheet.mergeCells(`A${currentRow}:K${currentRow}`)
	const evalTitle = worksheet.getCell(`A${currentRow}`)
	evalTitle.value = ' 종합 평가'
	evalTitle.font = { bold: true, size: 12 }
	evalTitle.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFE0E0E0' },
	}
	currentRow++

	worksheet.mergeCells(currentRow, 1, currentRow + 4, 2)
	const evalLabel = worksheet.getCell(currentRow, 1)
	evalLabel.value = '종합 평가\n\n(조치 내용 및\n점검 분석)'
	evalLabel.alignment = {
		horizontal: 'center',
		vertical: 'middle',
		wrapText: true,
	}
	evalLabel.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFF2F2F2' },
	}

	worksheet.mergeCells(currentRow, 3, currentRow, 10)
	worksheet.getCell(currentRow, 3).value =
		'  □ 안전 (정상)      □ 주의 (관찰 필요)      □ 위험 (즉시 조치)'
	worksheet.getCell(currentRow, 3).alignment = { vertical: 'middle' }

	worksheet.mergeCells(currentRow + 1, 3, currentRow + 4, 10)
	worksheet.getCell(currentRow + 1, 3).value = ' [점검자 의견]: '
	worksheet.getCell(currentRow + 1, 3).alignment = {
		vertical: 'top',
		wrapText: true,
	}

	for (let r = currentRow; r <= currentRow + 4; r++) {
		for (let c = 1; c <= 10; c++) {
			worksheet.getCell(r, c).border = {
				top: { style: 'thin' },
				bottom: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
			}
		}
	}
	currentRow += 6

	const signLabels = [
		{ label: '보 고 자', name: '이 름:', opinion: '보고자 의견:' },
		{ label: '검 토 자', name: '이 름:', opinion: '검토자 의견:' },
	]
	signLabels.forEach((s, idx) => {
		const startCol = idx === 0 ? 1 : 6
		worksheet.getCell(currentRow, startCol).value = s.label
		worksheet.getCell(currentRow, startCol).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFF2F2F2' },
		}
		worksheet.mergeCells(currentRow, startCol + 1, currentRow, startCol + 4)
		worksheet.getCell(currentRow, startCol + 1).value =
			`${s.name}                (서명/인)`

		worksheet.mergeCells(currentRow + 1, startCol, currentRow + 2, startCol + 4)
		worksheet.getCell(currentRow + 1, startCol).value = s.opinion
		worksheet.getCell(currentRow + 1, startCol).alignment = { vertical: 'top' }

		for (let r = currentRow; r <= currentRow + 2; r++) {
			for (let c = startCol; c <= startCol + 4; c++) {
				worksheet.getCell(r, c).border = {
					top: { style: 'thin' },
					bottom: { style: 'thin' },
					left: { style: 'thin' },
					right: { style: 'thin' },
				}
			}
		}
	})

	// 컬럼 너비 최종 조정
	worksheet.columns = [
		{ width: 8 },
		{ width: 14 },
		{ width: 30 },
		{ width: 15 },
		{ width: 22 },
		{ width: 22 },
		{ width: 12 },
		{ width: 15 },
		{ width: 9 },
		{ width: 9 },
		{ width: 9 },
	]

	return await workbook.xlsx.writeBuffer()
}

/** 보조 함수들 **/
function parseDurationToSeconds(duration) {
	if (!duration) return 0
	const str = String(duration)
	if (str.includes(':')) {
		const p = str.split(':').map(Number)
		return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
	}
	return parseFloat(str.replace(/[^0-9.]/g, '')) || 0
}

function formatSeconds(sec) {
	const h = Math.floor(sec / 3600)
		.toString()
		.padStart(2, '0')
	const m = Math.floor((sec % 3600) / 60)
		.toString()
		.padStart(2, '0')
	const s = (sec % 60).toString().padStart(2, '0')
	return `${h}:${m}:${s}`
}

const NodeService = {
	/**
	 * 특정 노드의 위치 정보를 업데이트합니다.
	 */
	updateSingleNodePosition: async (nodeNum, position) => {
		try {
			// 1. DB 업데이트 로직 (프로젝트에서 사용하는 DB 라이브러리에 맞춰 수정하세요)
			// 예: const result = await db.nodes.update({ where: { nodeNum }, data: { position } });

			// 임시 로직 예시 (DB 연동 부분):
			// const [result] = await pool.query(
			//     'UPDATE nodes SET position = ? WHERE node_num = ?',
			//     [position, nodeNum]
			// );

			// 2. 업데이트 결과 처리 (영향을 받은 행이 있는지 체크)
			// if (result.affectedRows === 0) {
			//     return { state: 'fail', message: '해당 노드를 찾을 수 없습니다.' };
			// }

			return { state: 'success' }
		} catch (error) {
			console.error('Service Error:', error)
			return {
				state: 'fail',
				message: '데이터베이스 업데이트 중 오류가 발생했습니다.',
			}
		}
	},
}
module.exports = {
	createNodesData,
	getNodesData,
	getAllTypeActiveNodesData,
	downloadNodeHistoryData,
	updateNodeStatusData,
	deleteNodeData,
	setNodesPositionData,
	handleNodeMqttMessage,
	updateNodePositionData,
	downloadDetailedNodeLogData,
	createExcelFile,
}
