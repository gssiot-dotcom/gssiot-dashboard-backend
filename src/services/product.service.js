// ProductService
// - DB(MongoDB)와 MQTT, 파일시스템을 직접 다루는 비즈니스 로직 계층입니다.
// - 컨트롤러(product.controller.js)에서는 이 클래스를 호출해서 실제 작업을 수행합니다.

const NodeSchema = require('../modules/nodes/door-node/node.model')
const NodeHistorySchema = require('../modules/nodes/door-node/node.model')
const GatewaySchema = require('../modules/gateways/gateway.model')
const BuildingSchema = require('../modules/building/building.model')
const { mqttClient, mqttEmitter } = require('./Mqtt.service')
const fileService = require('./file.service')
const AngleNodeSchema = require('../modules/nodes/angle-node/angleNode.model')
const fs = require('fs/promises')
const path = require('path')
const { logger, logError } = require('../lib/logger')

class ProductService {
	constructor() {
		// 주입받지 않고 직접 스키마를 할당해서 사용
		this.nodeSchema = NodeSchema
		this.gatewaySchema = GatewaySchema
		this.buildingSchema = BuildingSchema
		this.nodeHistorySchema = NodeHistorySchema
		this.angleNodeSchema = AngleNodeSchema
	}

	// =============================== Product creating & getting logics ================================== //

	/**
	 * 해치발판 Node 여러 개를 한 번에 생성하는 서비스
	 * @param {Array} arrayData - [{ doorNum, ... }, ...]
	 * 1. doorNum 기준으로 기존 노드 중복 여부 확인
	 * 2. 중복 있으면 에러 throw
	 * 3. insertMany 로 한 번에 노드 생성
	 */
	async createNodesData(arrayData) {
		try {
			// 이미 존재하는 doorNum 이 있는지 확인
			const existNodes = await this.nodeSchema.find({
				doorNum: { $in: arrayData.map(data => data.doorNum) },
			})
			if (existNodes.length > 0) {
				const existNodeNums = existNodes.map(node => node.doorNum)
				throw new Error(
					`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`
				)
			}

			// 중복이 없으면 그대로 삽입
			const result = await this.nodeSchema.insertMany(arrayData)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	/**
	 * 비계전도(AngleNode) 여러 개를 생성하는 서비스
	 * @param {Array} arrayData - [{ doorNum }, ...]
	 * 1. doorNum 기준 중복 체크
	 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
	 */
	async createAngleNodesData(arrayData) {
		try {
			// 이미 존재하는 doorNum 이 있는지 확인
			const existNodes = await this.angleNodeSchema.find({
				doorNum: { $in: arrayData.map(obj => obj.doorNum) },
			})
			if (existNodes.length > 0) {
				const existNodeNums = existNodes.map(node => node.doorNum)
				throw new Error(
					`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`
				)
			}

			// AngleNode 는 doorNum 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
			const arrayObject = arrayData.map(({ doorNum }) => ({
				doorNum,
			}))

			const result = await this.angleNodeSchema.insertMany(arrayObject)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	/**
	 * 사무실용 게이트웨이 생성
	 * @param {Object} data - { serial_number, ... }
	 * 1. serial_number 중복 체크
	 * 2. 중복이 없으면 gatewaySchema.create 로 생성
	 */
	async createOfficeGatewayData(data) {
		try {
			// 동일 일련번호의 게이트웨이가 있는지 확인
			const existGateway = await this.gatewaySchema.findOne({
				serial_number: data.serial_number,
			})

			if (existGateway) {
				throw new Error(
					`노드 번호가 ${existGateway.serial_number} 인 기존 게이트웨이가 있습니다, 다른 넘버를 입력히세요.`
				)
			}

			const result = await this.gatewaySchema.create(data)
			return result
		} catch (error) {
			throw new Error(`${error.message}`)
		}
	}

	/**
	 * 일반 게이트웨이만 생성
	 * @param {Object} data - { serial_number, ... }
	 */
	async createGatewayData(data) {
		try {
			// 기존 게이트웨이 존재 여부 체크
			const existGateway = await this.gatewaySchema.findOne({
				serial_number: data.serial_number,
			})
			if (existGateway) {
				throw new Error(
					`일련 번호가 ${existGateway.serial_number}인 기존 게이트웨이가 있습니다. `
				)
			}

			// ⭐ 노드/AngleNode/MQTT 아무 것도 안 건드리고, 게이트웨이만 생성
			const gateway = await this.gatewaySchema.create(data)
			return gateway
		} catch (error) {
			throw new Error(`Error on creating-gateway: ${error.message}`)
		}
	}

	/**
	 * 기존 게이트웨이에 일반 노드(Node)들을 연결 + MQTT로 노드 리스트 publish
	 * @param {Object} data - { gateway_id, nodes:[ObjectId,...] }
	 */
	async combineNodesToGatewayData(data) {
		try {
			const { gateway_id, nodes: nodesId } = data

			// 1) 게이트웨이 존재 여부 확인
			const gateway = await this.gatewaySchema.findById(gateway_id)
			if (!gateway) {
				throw new Error('Gateway not found, 먼저 게이트웨이를 생성하세요.')
			}

			// 2) 연결할 Node 들의 doorNum 조회
			const nodes = await this.nodeSchema.find(
				{ _id: { $in: nodesId } },
				{ doorNum: 1, _id: 0 }
			)

			if (!nodes || nodes.length === 0) {
				throw new Error('연결할 노드가 없습니다. nodes 배열을 확인하세요.')
			}

			// 3) MQTT publish 준비
			const gw_number = gateway.serial_number
			const topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

			const publishData = {
				cmd: 2, // 노드 리스트 설정
				nodeType: 0, // 0: 일반 Node
				numNodes: nodes.length,
				nodes: nodes.map(node => node.doorNum),
			}

			// 4) MQTT 서버로 publish + 응답 대기
			if (mqttClient.connected) {
				const publishPromise = new Promise((resolve, reject) => {
					mqttClient.publish(topic, JSON.stringify(publishData), err => {
						if (err) {
							reject(new Error(`MQTT publishing failed for topic: ${topic}`))
						} else {
							resolve(true)
						}
					})
				})
				await publishPromise

				const mqttResponsePromise = new Promise((resolve, reject) => {
					mqttEmitter.once('gwPubRes', data => {
						if (data.resp === 'success') {
							resolve(true)
						} else {
							reject(new Error('Failed publishing gateway nodes to mqtt'))
						}
					})

					// 10초 타임아웃
					setTimeout(() => {
						reject(new Error('MQTT response timeout'))
					}, 10000)
				})

				await mqttResponsePromise
			} else {
				throw new Error('MQTT client is not connected')
			}

			// 5) MQTT 설정 성공 시 Node 들을 게이트웨이에 귀속 + 비활성화
			await this.nodeSchema.updateMany(
				{ _id: { $in: nodesId } },
				{ $set: { node_status: false, gateway_id: gateway._id } }
			)

			// 6) 게이트웨이의 nodes 필드 갱신
			gateway.nodes = nodesId
			const updatedGateway = await gateway.save()

			return updatedGateway
		} catch (error) {
			throw new Error(`Error on combining-nodes-to-gateway: ${error.message}`)
		}
	}

	/**
	 * 사무실 게이트웨이 깨우기 / 알람 설정 MQTT 전송
	 * @param {String} gw_number - 게이트웨이 일련번호
	 * @param {Boolean} alarmActive - 알람 활성 여부
	 * @param {Number} alertLevel - 알람 단계
	 * Flow:
	 *  1. gw_number 기반 토픽 생성
	 *  2. cmd:3, alarmActive/alertLevel 포함해 MQTT publish
	 */
	async makeWakeUpOfficeGateway(gw_number, alarmActive, alertLevel) {
		try {
			// 게이트웨이 토픽
			let topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

			const publishData = {
				cmd: 3, // 3: wake-up / 알람 설정 명령
				alarmActive,
				alertLevel: alertLevel,
			}
			console.log('Publish-data:', publishData)

			// MQTT 연결 여부 확인 후 publish
			if (mqttClient.connected) {
				console.log(topic)
				mqttClient.publish(topic.toString(), JSON.stringify(publishData))
			} else {
				throw new Error('MQTT client is not connected')
			}

			// 호출 측에서 토픽을 확인할 수 있도록 반환
			return topic
		} catch (error) {
			throw new Error(`Error on creating-gateway: ${error.message}`)
		}
	}

	/**
	 * 비계전도 Angle-Node 를 게이트웨이에 연결 + MQTT publish
	 * @param {Object} data - { gateway_id, serial_number, angle_nodes:[ObjectId...] }
	 * Flow:
	 *  1. gateway_id 로 게이트웨이 존재 여부 확인
	 *  2. angle_nodes 에 해당하는 AngleNode들의 doorNum 조회
	 *  3. cmd:2, nodeType:1 로 MQTT publish
	 *  4. 응답(gwPubRes) 수신
	 *  5. AngleNode 들을 gateway_id 에 묶고 node_status=false
	 *  6. 게이트웨이에 angle_nodes 배열 저장
	 */
	async combineAngleNodeToGatewayData(data) {
		try {
			// gateway 존재 여부 확인
			const existGateway = await this.gatewaySchema.findOne({
				_id: data.gateway_id,
			})
			if (!existGateway) {
				throw new Error(
					`일련 번호가 ${existGateway.serial_number}인 게이트웨이가 없습니다. 먼저 게이트웨이를 생성하세요`
				)
			}

			// MQTT publish 준비
			const gw_number = data.serial_number
			const nodesId = data.angle_nodes
			const nodes = await this.angleNodeSchema.find(
				{ _id: { $in: nodesId } },
				{ doorNum: 1, _id: 1 }
			)

			let topic = `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${gw_number}`

			const publishData = {
				cmd: 2,
				nodeType: 1, // 1: Angle-Node
				numNodes: nodes.length,
				nodes: nodes.map(node => node.doorNum),
			}
			logger('Publish-data:', publishData, topic)

			// MQTT 연결 확인 및 publish + 응답 대기
			if (mqttClient.connected) {
				const publishPromise = new Promise((resolve, reject) => {
					mqttClient.publish(topic, JSON.stringify(publishData), err => {
						if (err) {
							reject(
								new Error(
									`MQTT publishing failed for Angle-node topic: ${topic}`
								)
							)
						} else {
							resolve(true)
						}
					})
				})

				await publishPromise

				const mqttResponsePromise = new Promise((resolve, reject) => {
					mqttEmitter.once('gwPubRes', data => {
						if (data.resp === 'success') {
							resolve(true)
						} else {
							reject(
								new Error('Failed publishing for Angle-node gateway to mqtt')
							)
						}
					})

					setTimeout(() => {
						reject(new Error('MQTT response timeout'))
					}, 10000)
				})

				await mqttResponsePromise
			} else {
				throw new Error('MQTT client is not connected')
			}

			// MQTT 설정 성공 시 Angle-Node 들을 게이트웨이에 귀속 및 비활성화
			const angle_nodes = await this.angleNodeSchema.updateMany(
				{ _id: { $in: nodesId } },
				{ $set: { node_status: false, gateway_id: existGateway._id } }
			)

			// 게이트웨이의 angle_nodes 배열 업데이트
			await existGateway.updateOne({ $set: { angle_nodes: nodesId } })

			return angle_nodes
		} catch (error) {
			throw new Error(`Error on creating-gateway: ${error.message}`)
		}
	}

	/**
	 * 전체 게이트웨이 목록 조회
	 */
	async getGatewaysData() {
		try {
			const gateways = await this.gatewaySchema.find()
			if (!gateways || gateways.length == 0) {
				throw new Error('There is no any gateways in database :(')
			}
			return gateways
		} catch (error) {
			throw error
		}
	}

	/**
	 * gateway_status = true 인 게이트웨이만 조회
	 * - 없으면 빈 배열 반환
	 */
	async getActiveGatewaysData() {
		try {
			const gateways = await this.gatewaySchema.find({ gateway_status: true })
			if (!gateways || gateways.length == 0) {
				return []
			}
			return gateways
		} catch (error) {
			throw error
		}
	}

	/**
	 * serial_number 로 게이트웨이 단건 조회
	 * @param {String} gatewayNumber
	 * @returns {Object|null}
	 */
	async getSingleGatewayData(gatewayNumber) {
		try {
			const gateway = await this.gatewaySchema.findOne({
				serial_number: gatewayNumber,
			})

			return gateway || null
		} catch (error) {
			throw new Error(`Gateway olishda xatolik: ${error.message}`)
		}
	}

	/**
	 * 모든 Node 조회
	 */
	async getNodesData() {
		try {
			const nodes = await this.nodeSchema.find()
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
	async getActiveNodesData() {
		try {
			const nodes = await this.nodeSchema.find({ node_status: true })
			if (!nodes || nodes.length == 0) {
				return []
			}
			return nodes
		} catch (error) {
			throw error
		}
	}

	/**
	 * node_status = true 인 활성 Angle-Node 들만 조회
	 * @returns {Array|null}
	 */
	async getActiveAngleNodesData() {
		try {
			const angleNodes = await this.angleNodeSchema.find({ node_status: true })

			return angleNodes || null
		} catch (error) {
			throw new Error(`Error on getting Angle-Nodes: ${error.message}`)
		}
	}

	/**
	 * (아직 사용 안 하는 것처럼 보임) ProductSchema 기준 단일 조회용
	 * 현재 this.ProductSchema 가 정의되어 있지 않으므로 실제로는 호출되지 않는 메서드로 보임.
	 */
	async getProductData(id) {
		try {
			const result = await this.ProductSchema.findById(id)
			return result
		} catch (error) {
			throw new Error('Error on fetching Product by id')
		}
	}

	/**
	 * 빌딩 ID 기준으로 노드 히스토리 통계를 내고, 엑셀 파일 버퍼를 생성
	 * Flow:
	 *  1. Building 조회 → gateway_sets 에 포함된 게이트웨이들의 serial_number 추출
	 *  2. NodeHistory 에서 gw_number ∈ serialNumbers 인 기록 모두 조회
	 *  3. doorNum 별로 doorChk=1 인 횟수와 마지막 열린 시간 집계
	 *  4. 집계 결과 배열(result)을 createExcelFile 에 전달하여 ExcelJS 버퍼 생성
	 */
	async downloadNodeHistoryData(buildingId) {
		try {
			// 빌딩 정보 조회 (어떤 게이트웨이들이 연결되어 있는지 확인)
			const building = await this.buildingSchema.findById(buildingId)

			// 빌딩에 연결된 게이트웨이들의 serial_number 추출
			const buildingGateways = await this.gatewaySchema.find(
				{
					_id: { $in: building.gateway_sets },
				},
				{ serial_number: 1, _id: 0 }
			)

			const serialNumbers = buildingGateways.map(
				gateway => gateway.serial_number
			)

			// 해당 게이트웨이들에서 발생한 NodeHistory 전체 조회
			const history = await this.nodeHistorySchema.find({
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
	 * Node History 통계 배열을 받아 ExcelJS 로 엑셀 파일 버퍼 생성
	 * @param {Array} reportArr - [{ doorNum, gw_number, doorOpen_count, last_open }, ...]
	 * - 헤더(한글) 설정
	 * - 헤더 스타일(굵게, 가운데 정렬, 배경색, 테두리)
	 * - 각 행 스타일 (폰트 크기, 테두리, 가운데 정렬)
	 * - doorOpen_count >= 100 인 경우 빨간색 계열 강조
	 */
	async createExcelFile(reportArr) {
		const ExcelJS = require('exceljs')
		const workbook = new ExcelJS.Workbook()
		const worksheet = workbook.addWorksheet('MQTT Data')

		// 열 정의 및 헤더 텍스트(한글)
		worksheet.columns = [
			{ header: '노드 넘버', key: 'doorNum', width: 25 },
			{ header: '노드 속한 게이트웨이 넘버', key: 'gw_number', width: 35 },
			{ header: '문 열림 횟수', key: 'doorOpen_count', width: 25 },
			{ header: '마지막 열림 날짜', key: 'last_open', width: 25 },
		]

		// 헤더 스타일
		const headerRow = worksheet.getRow(1)
		headerRow.height = 40
		headerRow.eachCell(cell => {
			cell.font = { bold: true }
			cell.alignment = { horizontal: 'center', vertical: 'middle' }
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FFFF00' }, // 노란 배경
			}
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				bottom: { style: 'thin' },
				right: { style: 'thin' },
			}
		})

		// 데이터 행 추가 + 스타일
		reportArr.forEach(item => {
			const row = worksheet.addRow({
				gw_number: item.gw_number,
				doorNum: item.doorNum,
				doorOpen_count: item.doorOpen_count,
				last_open: item.last_open,
			})

			row.height = 35
			row.eachCell({ includeEmpty: true }, cell => {
				cell.alignment = { horizontal: 'center', vertical: 'middle' }
				cell.border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				}
				cell.font = {
					size: 14,
					bold: false,
				}
			})

			// doorOpen_count 값에 따라 색상 처리 (100회 이상: 빨간색 강조)
			const doorOpen_count = row.getCell('doorOpen_count')
			if (item.doorOpen_count >= 100) {
				doorOpen_count.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'ffDB5555' }, // 진한 빨간 계열
				}
				doorOpen_count.font = {
					color: { argb: 'FFFFFFFF' }, // 흰색 글자
					size: 14,
					bold: true,
				}
			} else {
				doorOpen_count.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: '69B5F7' }, // 파란 계열
				}
			}
		})

		// 엑셀을 메모리 버퍼로 변환
		const buffer = await workbook.xlsx.writeBuffer()
		return buffer
	}

	// =============================== Product changing logic ================================== //

	/**
	 * 노드 상태 토글 (node_status true ↔ false)
	 * @param {String} nodeId
	 */
	async updateNodeStatusData(nodeId) {
		try {
			// MongoDB 4.2 부터 지원되는 파이프라인 업데이트 사용
			const updatingNode = await this.nodeSchema.findOneAndUpdate(
				{ _id: nodeId },
				[{ $set: { node_status: { $not: '$node_status' } } }],
				{ new: true } // 변경 후 도큐먼트를 반환
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
	async deleteNodeData(nodeId) {
		try {
			const deletingNode = await this.nodeSchema.findOneAndDelete({
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
	 * 게이트웨이 상태 토글 (gateway_status true ↔ false)
	 * @param {String} gatewayId
	 */
	async updateGatewayStatusData(gatewayId) {
		try {
			const updatingGateway = await this.gatewaySchema.findOneAndUpdate(
				{ _id: gatewayId },
				[{ $set: { gateway_status: { $not: '$gateway_status' } } }],
				{ new: true }
			)

			if (!updatingGateway) {
				throw new Error('Node not found')
			}

			return updatingGateway
		} catch (error) {
			throw error
		}
	}

	/**
	 * 게이트웨이 삭제 + 게이트웨이에 묶여 있던 Node 상태 복구
	 * @param {String} gatewayId
	 * Flow:
	 *  1. gatewayId 로 게이트웨이 조회
	 *  2. gateway.nodes 배열에 포함된 Node 들의 node_status=true 로 돌려놓기
	 *  3. 게이트웨이 삭제
	 *  4. 전체 게이트웨이 목록 반환
	 */
	async deleteGatewayData(gatewayId) {
		try {
			// Gateway 존재 여부 확인
			const gateway = await this.gatewaySchema.findById(gatewayId)
			if (!gateway) {
				throw new Error('Gateway not found')
			}

			// Gateway 에 연결된 노드 목록
			const nodeIds = gateway.nodes

			// 노드가 존재한다면 node_status=true 로 복구
			if (nodeIds.length > 0) {
				await this.nodeSchema.updateMany(
					{ _id: { $in: nodeIds } },
					{ $set: { node_status: true } }
				)
			} else {
				throw new Error('Gateway does not contain any nodes')
			}

			// gateway 삭제
			const deletingGateway = await this.gatewaySchema.findOneAndDelete({
				_id: gatewayId,
			})
			if (!deletingGateway) {
				throw new Error('Gateway not found or already deleted')
			}

			// 남아있는 전체 게이트웨이 목록 리턴
			const updatedGateways = await this.gatewaySchema.find()
			return updatedGateways
		} catch (error) {
			console.error('Error deleting gateway:', error)
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
	async setNodesPositionData(nodesPosition, buildingId, file) {
		try {
			// 각 노드에 대한 position 업데이트
			const updatePromises = nodesPosition.map(async item => {
				const result = await this.nodeSchema.updateMany(
					{ doorNum: item.nodeNum },
					{ $set: { position: item.position } }
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
			const building = await this.buildingSchema.findById(buildingId)
			if (building) {
				const oldFilename = building.nodes_position_file

				if (oldFilename && oldFilename.trim() !== '') {
					fileService.delete(oldFilename)
				}

				await this.buildingSchema.findByIdAndUpdate(
					buildingId,
					{ nodes_position_file: fileName },
					{ new: true }
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

	// ============================== Angle-Node-Services ================================== //

	/**
	 * 비계전도 노드 이미지 업로드 + 기존 이미지 삭제 + position 업데이트
	 * @param {String} nodeId - AngleNode _id
	 * @param {String} nodePosition - 문자열 위치 정보
	 * @param {String} imageUrl - 새 이미지 파일명(또는 경로)
	 * Flow:
	 *  1. 기존 문서에서 angle_node_img 값을 읽어와 기존 파일 삭제 시도
	 *  2. 삭제 중 ENOENT(파일 없음)는 무시, 다른 에러는 로그 기록
	 *  3. 새 imageUrl 과 position 으로 AngleNode 업데이트
	 */
	async uploadAngleNodeImageData(nodeId, nodePosition, imageUrl) {
		const IMAGES_DIR = path.join(process.cwd(), 'static', 'images')
		try {
			// 1) 기존 도큐먼트에서 이전 이미지 파일명 확인
			const existing = await this.angleNodeSchema
				.findById(nodeId)
				.select('angle_node_img')
				.lean()

			if (!existing) throw new Error('There is no any building with this _id')

			const oldImage = existing.angle_node_img
			logger(`existing: ${oldImage}`)

			// 이전 이미지가 있고, 이번에 올린 이미지와 다르면 파일 삭제 시도
			if (oldImage && oldImage !== imageUrl) {
				const oldBasename = path.basename(oldImage)
				const oldFilePath = path.join(IMAGES_DIR, oldBasename)

				logger(`cwd: ${process.cwd()}`)
				logger(`IMAGES_DIR: ${IMAGES_DIR}`)
				logger(`oldFilePath: ${oldFilePath}`)
				try {
					await fs.access(oldFilePath)
					await fs.unlink(oldFilePath)
					logger(`Old building plan image is deleted: ${oldFilePath}`)
				} catch (error) {
					// ENOENT(파일 없음)은 무시, 그 외 에러만 로그
					if (error.code !== 'ENOENT') {
						logError(
							`Failed to delete old image ${oldFilePath}: ${error.message}`
						)
					} else {
						logError(
							`Failed to delete old image ${oldFilePath}: ${error.message}`
						)
					}
				}
			}

			// 새 이미지 파일명과 position 으로 AngleNode 업데이트
			const angleNode = await this.angleNodeSchema.findByIdAndUpdate(
				nodeId,
				{ $set: { angle_node_img: imageUrl, position: nodePosition } },
				{ new: true }
			)
			if (!angleNode) throw new Error('There is no any angleNode with this _id')
			return angleNode
		} catch (error) {
			logError(`Error on uploading building image: ${error}`)
			throw error
		}
	}

	// ============================== Temporary Services ================================== //

	/**
	 * 게이트웨이에 zone_name(구역 이름) 설정
	 * @param {String} gatewayId
	 * @param {String} zoneName
	 */
	async setGatewayZoneNameData(gatewayId, zoneName) {
		try {
			const existing = await this.gatewaySchema.findById(gatewayId)
			if (!existing) throw new Error('There is no any gateway with this _id')

			existing.zone_name = zoneName
			const updatedGateway = await existing.save()
			return updatedGateway
		} catch (error) {
			logError(`Error on uploading building image: ${error}`)
			throw error
		}
	}

	/**
	 * AngleNode.position 을 doorNum 기준으로 일괄 설정
	 * @param {Array} positionsArray - [{ doorNum, position }, ...]
	 * Flow:
	 *  1. 각 doorNum 에 해당하는 AngleNode 조회
	 *  2. 없으면 에러 throw
	 *  3. 존재하면 position 업데이트 후 저장
	 */
	async setAngleNodePositionData(positionsArray) {
		try {
			for (const item of positionsArray) {
				const existing = await this.angleNodeSchema.findOne({
					doorNum: item.doorNum,
				})
				if (!existing)
					throw new Error(
						`There is no any angleNode with this doorNum: ${item.doorNum}`
					)
				existing.position = item.position
				await existing.save()
			}

			const result = { message: 'All angle-nodes positions are set.' }
			return result
		} catch (error) {
			logError(`Error on uploading building image: ${error}`)
			throw error
		}
	}
}

module.exports = ProductService
