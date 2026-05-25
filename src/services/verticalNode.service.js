const VertcalNodeSchema = require('../schema/Vertical.node.model')
const VerticalNodeHistorySchema = require('../schema/Vertical.n.history.model')
const GatewaySchema = require('../schema/Gateway.model')
const BuildingSchema = require('../schema/Building.model')

class VerticalNodeService {
	constructor() {
		// 주입받지 않고 직접 스키마를 할당해서 사용
		this.verticalNodeSchema = VertcalNodeSchema
		this.gatewaySchema = GatewaySchema
		this.buildingSchema = BuildingSchema
		this.verticalNodeHistorySchema = VerticalNodeHistorySchema
	}

	// =============================== Product creating & getting logics ================================== //

	/**
	 * 비계전도(VerticalNode) 여러 개를 생성하는 서비스
	 * @param {Array} arrayData - [{ doorNum }, ...]
	 * 1. doorNum 기준 중복 체크
	 * 2. 중복이 없으면 doorNum만 뽑아서 문서 생성(나머지 필드는 기본값)
	 */
	async createVerticalNodesData(arrayData) {
		try {
			// 이미 존재하는 node_number 이 있는지 확인
			const existNodes = await this.verticalNodeSchema.find({
				node_number: { $in: arrayData.map(obj => obj.node_number) },
			})
			if (existNodes.length > 0) {
				const existNodeNums = existNodes.map(node => node.node_number)
				throw new Error(
					`노드 번호가 ${existNodeNums.join(',')}인 기존 노드가 있습니다 !`
				)
			}

			// VerticalNode 는 node_number 만 세팅하여 생성 (position 등은 추후 별도 API로 세팅)
			const arrayObject = arrayData.map(
				({ node_number, angle_x, angle_y, gateway_id }) => ({
					node_number,
					angle_x,
					angle_y,
					gateway_id,
				})
			)

			const result = await this.verticalNodeSchema.insertMany(arrayObject)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async getVerticalNodesByGatewayId(gatewayId) {
		try {
			const verticalNodes = await this.verticalNodeSchema.find({
				gateway_id: gatewayId,
			})
			return verticalNodes
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async getVerticalNodes() {
		try {
			const verticalNodes = await this.verticalNodeSchema.find({})
			return verticalNodes
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async deleteVerticalNodeById(verticalNodeId) {
		try {
			const result = await this.verticalNodeSchema.findByIdAndDelete(
				verticalNodeId
			)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}

	async updateVerticalNodeStatus(verticalNodeId) {
		try {
			const result = await this.verticalNodeSchema.findByIdAndUpdate(
				verticalNodeId,
				[{ $set: { node_status: { $not: '$node_status' } } }],
				{ new: true }
			)
			return result
		} catch (error) {
			throw new Error(`Error: ${error.message}`)
		}
	}
}

module.exports = VerticalNodeService
