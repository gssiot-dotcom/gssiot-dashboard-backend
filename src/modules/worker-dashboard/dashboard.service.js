const mongoose = require('mongoose')
const {
	NODE_TYPE,
	COMPANY_MEMBER_TYPES,
	MEMBER_STATUS,
} = require('../../lib/config')

const {
	BuildingSchema,
	BuildingWorkerSchema,
	BuildingAlarmLevelSchema,
} = require('../building/building.model')
const Gateway = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')
const {
	CompanyMemberSchema,
	CompanySchema,
} = require('../company/company.model')

class WorkerDashboardService {
	constructor() {
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.alarmLevelSchema = BuildingAlarmLevelSchema
		this.gatewaySchema = Gateway
		this.nodeSchema = NodeSchema
		this.nodeTypes = Object.values(NODE_TYPE)
	}

	// ================= Helper services ======================== //

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	checkObjectId(id, fieldName = 'id') {
		if (!id || !mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(`${fieldName} is not valid`, 400)
		}
	}

	normalizeNodeType(nodeType) {
		const value = String(nodeType || '')
			.trim()
			.toUpperCase()

		const matchedType = this.nodeTypes.find(
			type => String(type).toUpperCase() === value,
		)

		if (!matchedType) {
			throw this.createError(
				`Invalid nodeType. Allowed values: ${this.nodeTypes.join(', ')}`,
				400,
			)
		}

		return matchedType
	}

	buildEmptyNodeCounts() {
		const counts = {}

		for (const type of this.nodeTypes) {
			counts[type] = 0
		}

		counts.total = 0

		return counts
	}

	buildNodeCards(nodeCounts) {
		return this.nodeTypes.map(type => ({
			node_type: type,
			count: nodeCounts[type] || 0,
		}))
	}

	async validateWorkerBuildingAccess(userId, buildingId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw this.createError('Invalid user id', 400)
		}

		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		const assignment = await this.buildingWorkerSchema.findOne({
			user_id: userId,
			building_id: buildingId,
			status: true,
		})

		if (!assignment) {
			throw this.createError('You are not assigned to this building', 403)
		}

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		return building
	}

	async getAuthorizedWorkerMembership({ userId }) {
		this.checkObjectId(userId, 'userId')

		const workerRole = COMPANY_MEMBER_TYPES.worker

		const query = {
			memberId: userId,
			status: MEMBER_STATUS.ACTIVE,
			memberRole: workerRole,
		}

		const membership = await this.companyMemberSchema.findOne(query).lean()

		if (!membership) {
			throw this.createError(
				'You do not have worker permission for this building',
				403,
			)
		}

		return membership
	}

	async checkWorkerBuilding({ userId, buildingId }) {
		this.checkObjectId(buildingId, 'buildingId')
		const membership = await this.getAuthorizedWorkerMembership({ userId })

		const building = await this.buildingSchema
			.findOne({
				_id: buildingId,
				companyId: membership.companyId,
			})
			.lean()

		if (!building) throw this.createError('Building not found', 404)

		return { building, companyId: membership.companyId }
	}

	// ================= Endpoint services ======================== //

	async getMyCompany(userId) {
		const membership = await this.getAuthorizedWorkerMembership({ userId })

		if (!membership) throw this.createError('Your membership not found', 404)

		const company = await this.companySchema
			.findById(membership.companyId)
			.lean()

		if (!company) throw this.createError('Your Company not found', 404)
		return company
	}

	async getWorkerDashboardPage(userId) {
		// 1. Worker company member ekanini tekshirish
		const query = {
			memberId: userId,
			status: MEMBER_STATUS.ACTIVE,
			memberRole: COMPANY_MEMBER_TYPES.worker,
		}
		const companyMembership = await this.companyMemberSchema
			.findOne(query)
			.lean()

		if (!companyMembership) {
			throw this.createError('Company membership not found', 403)
		}

		const companyId = companyMembership.companyId

		const company = await this.companySchema.findOne({ _id: companyId }).lean()
		if (!company) throw this.createError('Company not found', 404)

		// 2. Workerga biriktirilgan buildinglarni topish
		const workerBuildings = await this.buildingWorkerSchema
			.find({
				companyId,
				userId,
				status: MEMBER_STATUS.ACTIVE,
			})
			.sort({ createdAt: -1 })
			.lean()

		if (!workerBuildings.length) {
			return { buildingsList: [] }
		}

		const buildingIds = workerBuildings.map(item => item.buildingId)

		// 3. Building ma'lumotlarini olish
		const buildings = await this.buildingSchema
			.find({
				_id: { $in: buildingIds },
				companyId,
			})
			.sort({ createdAt: -1 })
			.lean()

		if (!buildings.length) {
			return { buildingsList: [] }
		}

		const foundBuildingIds = buildings.map(b => b._id)

		// 4. Gateway va workerlarni olish
		const [buildingGateways, buildingWorkers] = await Promise.all([
			this.gatewaySchema
				.find({
					companyId,
					buildingId: { $in: foundBuildingIds },
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.buildingWorkerSchema
				.find({
					companyId,
					buildingId: { $in: foundBuildingIds },
					status: MEMBER_STATUS.ACTIVE,
				})
				.populate({ path: 'userId', select: '_id name email phone userType' })
				.sort({ createdAt: -1 })
				.lean(),
		])

		const gatewayIds = buildingGateways.map(gw => gw._id)

		const buildingNodes = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId,
						gatewayId: { $in: gatewayIds },
						isAssigned: true,
					})
					.lean()
			: []

		// 5. Statistics object tayyorlash
		const statsByBuildingId = {}
		const gatewayIdToBuildingId = {}

		for (const building of buildings) {
			statsByBuildingId[building._id.toString()] = {
				totalNodesCount: 0,
				onlineNodesCount: 0,
				totalGatewaysCounts: 0,
				totalWorkersCount: 0,

				doorNodeCount: 0,
				angleNodeCount: 0,
				gangformNodeCount: 0,
			}
		}

		// 6. Gateway count
		for (const gateway of buildingGateways) {
			if (!gateway.buildingId) continue

			const buildingId = gateway.buildingId.toString()
			if (!statsByBuildingId[buildingId]) continue

			statsByBuildingId[buildingId].totalGatewaysCounts += 1
			gatewayIdToBuildingId[gateway._id.toString()] = buildingId
		}

		// 7. Worker count
		for (const worker of buildingWorkers) {
			if (!worker.buildingId) continue

			const buildingId = worker.buildingId.toString()
			if (!statsByBuildingId[buildingId]) continue

			statsByBuildingId[buildingId].totalWorkersCount += 1
		}

		// 8. Node count va node type count
		for (const node of buildingNodes) {
			if (!node.gatewayId) continue

			const buildingId = gatewayIdToBuildingId[node.gatewayId.toString()]
			if (!buildingId || !statsByBuildingId[buildingId]) continue

			const stats = statsByBuildingId[buildingId]

			stats.totalNodesCount += 1

			if (node.status !== 'offline') {
				stats.onlineNodesCount += 1
			}

			if (node.nodeType === 'door_node') {
				stats.doorNodeCount += 1
			}

			if (node.nodeType === 'angle_node') {
				stats.angleNodeCount += 1
			}

			if (node.nodeType === 'gangform_node') {
				stats.gangformNodeCount += 1
			}
		}

		// 9. Building list + statistics
		const buildingsList = buildings.map(building => ({
			...building,
			statistics: statsByBuildingId[building._id.toString()],
		}))

		return { buildingsList }
	}

	// ===================== Nodes page services ===================== //
	async getWorkerBuildingNodesPage({ userId, buildingId, nodeType }) {
		const { companyId } = await this.checkWorkerBuilding({
			userId,
			buildingId,
		})

		if (!nodeType) throw this.createError('nodeType is required', 400)

		const [gatewayList, buildingAlarmLevel] = await Promise.all([
			this.gatewaySchema
				.find({ companyId, buildingId, isAssigned: true })
				.sort({ createdAt: -1 })
				.lean(),

			this.alarmLevelSchema.findOne({ buildingId, alarmType: nodeType }).lean(),
		])

		const gatewayIds = gatewayList.map(gw => gw._id)

		const nodesList = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId,
						gatewayId: { $in: gatewayIds },
						nodeType,
						isAssigned: true,
					})
					.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
					.sort({ number: 1 })
					.lean()
			: []

		return {
			nodesList,
			gatewayList,
			buildingAlarmLevel: buildingAlarmLevel || {
				buildingId,
				alarmType: nodeType,
				blue: 0,
				green: 0,
				yellow: 0,
				red: 0,
			},
		}
	}
}

module.exports = WorkerDashboardService
