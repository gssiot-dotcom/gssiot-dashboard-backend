// services/ManagerDashboardService.js

const mongoose = require('mongoose')
const {
	COMPANY_MEMBER_TYPES,
	NODE_TYPE,
	COMPANY_STATUS,
	MEMBER_STATUS,
	ALARM_NODE_TYPES,
} = require('../../lib/config')
const {
	CompanySchema,
	CompanyMemberSchema,
} = require('../company/company.model')
const {
	BuildingSchema,
	BuildingWorkerSchema,
	BuildingAlarmLevelSchema,
} = require('../building/building.model')
const GatewaySchema = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')
const { UserSchema } = require('../users/user.model')
const bcrypt = require('bcryptjs')

class AdminBuildingsService {
	constructor() {
		this.userSchema = UserSchema
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = GatewaySchema
		this.nodeSchema = NodeSchema
		this.alarmLevelSchema = BuildingAlarmLevelSchema
	}

	createError(status, message) {
		const error = new Error(message)
		error.status = status
		return error
	}

	checkObjectId(id, fieldName = 'id') {
		if (!id || !mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(400, `${fieldName} is not valid`)
		}
	}

	async getManagerDashboard({ userId, companyId = null }) {
		const membership = await this.getAuthorizedManagerMembership({
			userId,
			companyId,
		})

		const targetCompanyId = membership.companyId

		const selfCompany = await this.companySchema
			.findOne({
				_id: targetCompanyId,
				companyStatus: COMPANY_STATUS.ACTIVE,
			})
			.lean()

		if (!selfCompany) {
			throw this.createError(404, 'Company not found or inactive')
		}

		const managerRole = COMPANY_MEMBER_TYPES.manager
		const workerRole = COMPANY_MEMBER_TYPES.worker

		const [
			buildingsCount,
			managersCount,
			workersCount,
			gatewaysCount,
			nodesCount,
			buildingsList,
			companyMembersList,
			gatewaysList,
		] = await Promise.all([
			this.buildingSchema.countDocuments({
				companyId: targetCompanyId,
			}),

			this.companyMemberSchema.countDocuments({
				companyId: targetCompanyId,
				memberRole: managerRole,
			}),

			this.companyMemberSchema.countDocuments({
				companyId: targetCompanyId,
				memberRole: workerRole,
			}),

			this.gatewaySchema.countDocuments({
				companyId: targetCompanyId,
				isAssigned: true,
			}),

			this.nodeSchema.countDocuments({
				companyId: targetCompanyId,
				isAssigned: true,
			}),

			this.buildingSchema
				.find({
					companyId: targetCompanyId,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.companyMemberSchema
				.find({
					companyId: targetCompanyId,
				})
				.populate({
					path: 'memberId',
					select: '_id name email phone userType ',
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		return {
			selfCompany,

			companyStatistics: {
				buildingsCount,
				managersCount,
				workersCount,
				gatewaysCount,
				nodesCount,
			},

			buildingsList,
			companyMembersList,
			gatewaysList,
		}
	}

	async getAdminCompanyBuildingsPage({ companyId }) {
		this.checkObjectId(companyId, 'companyId')

		const targetCompanyId = companyId

		const company = await this.companySchema
			.findOne({
				_id: targetCompanyId,
			})
			.lean()

		if (!company) {
			throw this.createError(404, 'Company not found')
		}

		const buildings = await this.buildingSchema
			.find({
				companyId: targetCompanyId,
			})
			.sort({ createdAt: -1 })
			.lean()

		const buildingIds = buildings.map(building => building._id)

		if (!buildingIds.length) {
			return {
				buildingsList: [],
			}
		}

		const [buildingGateways, buildingWorkers] = await Promise.all([
			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					buildingId: { $in: buildingIds },
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.buildingWorkerSchema
				.find({
					companyId: targetCompanyId,
					buildingId: { $in: buildingIds },
					status: MEMBER_STATUS.ACTIVE,
				})
				.populate({
					path: 'userId',
					select: '_id name email phone userType',
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		const gatewayIds = buildingGateways.map(gateway => gateway._id)

		const buildingNodes = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId: targetCompanyId,
						gatewayId: { $in: gatewayIds },
						isAssigned: true,
					})
					.lean()
			: []

		const statsByBuildingId = {}
		const gatewayIdToBuildingId = {}

		for (const building of buildings) {
			const buildingId = building._id.toString()

			statsByBuildingId[buildingId] = {
				totalNodesCount: 0,
				onlineNodesCount: 0,
				totalGatewaysCounts: 0,
				totalWorkersCount: 0,

				doorNodeCount: 0,
				angleNodeCount: 0,
				gangformNodeCount: 0,
			}
		}

		for (const gateway of buildingGateways) {
			if (!gateway.buildingId) continue

			const buildingId = gateway.buildingId.toString()

			if (!statsByBuildingId[buildingId]) continue

			statsByBuildingId[buildingId].totalGatewaysCounts += 1
			gatewayIdToBuildingId[gateway._id.toString()] = buildingId
		}

		for (const worker of buildingWorkers) {
			if (!worker.buildingId) continue

			const buildingId = worker.buildingId.toString()

			if (!statsByBuildingId[buildingId]) continue

			statsByBuildingId[buildingId].totalWorkersCount += 1
		}

		for (const node of buildingNodes) {
			if (!node.gatewayId) continue

			const gatewayId = node.gatewayId.toString()
			const buildingId = gatewayIdToBuildingId[gatewayId]

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

		const buildingsList = buildings.map(building => {
			const buildingId = building._id.toString()

			return {
				...building,
				statistics: statsByBuildingId[buildingId],
			}
		})

		return {
			buildingsList,
		}
	}

	async getAdminBuildingGatewaysDialog({ buildingId }) {
		this.checkObjectId(buildingId, 'buildingId')

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const targetCompanyId = building.companyId

		const [assignedGateways, unassignedGateways] = await Promise.all([
			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					buildingId,
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					$or: [{ buildingId: null }, { buildingId: { $exists: false } }],
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		const gatewaysList = [
			...assignedGateways.map(gateway => ({
				...gateway,
				checked: true,
				assignedBuildingId: buildingId,
			})),

			...unassignedGateways.map(gateway => ({
				...gateway,
				checked: false,
				assignedBuildingId: null,
			})),
		]

		return {
			gatewaysList,
		}
	}

	async updateAdminBuildingGatewaysDialog({ buildingId, gatewayIds = [] }) {
		this.checkObjectId(buildingId, 'buildingId')

		if (!Array.isArray(gatewayIds)) {
			throw this.createError(400, 'gatewayIds must be an array')
		}

		for (const gatewayId of gatewayIds) {
			this.checkObjectId(gatewayId, 'gatewayId')
		}

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const targetCompanyId = building.companyId

		const currentGateways = await this.gatewaySchema
			.find({
				companyId: targetCompanyId,
				buildingId,
				isAssigned: true,
			})
			.select('_id')
			.lean()

		const currentGatewayIds = currentGateways.map(gateway =>
			gateway._id.toString(),
		)

		const selectedGatewayIds = gatewayIds.map(id => id.toString())

		const gatewayIdsToUnassign = currentGatewayIds.filter(
			id => !selectedGatewayIds.includes(id),
		)

		if (gatewayIdsToUnassign.length) {
			await this.gatewaySchema.updateMany(
				{
					_id: { $in: gatewayIdsToUnassign },
					companyId: targetCompanyId,
					buildingId,
				},
				{
					$set: {
						buildingId: null,
					},
				},
			)
		}

		if (selectedGatewayIds.length) {
			await this.gatewaySchema.updateMany(
				{
					_id: { $in: selectedGatewayIds },
					companyId: targetCompanyId,
					$or: [
						{ buildingId },
						{ buildingId: null },
						{ buildingId: { $exists: false } },
					],
				},
				{
					$set: {
						buildingId,
					},
				},
			)
		}

		return {
			message: 'Gateways updated successfully',
		}
	}

	async getAdminBuildingWorkersDialog({ buildingId }) {
		this.checkObjectId(buildingId, 'buildingId')

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const targetCompanyId = building.companyId

		const workerRole = COMPANY_MEMBER_TYPES.worker

		const assignedBuildingMembers = await this.buildingWorkerSchema
			.find({
				companyId: targetCompanyId,
				buildingId,
				status: MEMBER_STATUS.ACTIVE,
			})
			.populate({
				path: 'userId',
				select: '_id name email phone userType',
			})
			.sort({ createdAt: -1 })
			.lean()

		const assignedUserIds = assignedBuildingMembers
			.map(member => member.userId?._id?.toString())
			.filter(Boolean)

		const inactiveCompanyMembers = await this.companyMemberSchema
			.find({
				companyId: targetCompanyId,
				memberRole: workerRole,
				status: MEMBER_STATUS.INACTIVE,
				memberId: { $nin: assignedUserIds },
			})
			.populate({
				path: 'memberId',
				select: '_id name email phone userType',
			})
			.sort({ createdAt: -1 })
			.lean()

		const workersList = [
			...assignedBuildingMembers
				.filter(member => member.userId)
				.map(member => ({
					_id: member.userId._id,
					name: member.userId.name,
					email: member.userId.email,
					phone: member.userId.phone,
					userType: member.userId.userType,
					checked: true,
					assignedBuildingId: buildingId,
					buildingMemberId: member._id,
				})),

			...inactiveCompanyMembers
				.filter(member => member.memberId)
				.map(member => ({
					_id: member.memberId._id,
					name: member.memberId.name,
					email: member.memberId.email,
					phone: member.memberId.phone,
					userType: member.memberId.userType,
					checked: false,
					assignedBuildingId: null,
					companyMemberId: member._id,
				})),
		]

		return {
			workersList,
		}
	}

	async updateAdminBuildingWorkers({ buildingId, workerIds = [] }) {
		this.checkObjectId(buildingId, 'buildingId')

		if (!Array.isArray(workerIds)) {
			throw this.createError(400, 'workerIds must be an array')
		}

		for (const workerId of workerIds) {
			this.checkObjectId(workerId, 'workerId')
		}

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const targetCompanyId = building.companyId
		const selectedWorkerIds = workerIds.map(id => id.toString())

		const currentBuildingMembers = await this.buildingWorkerSchema
			.find({
				companyId: targetCompanyId,
				buildingId,
				status: MEMBER_STATUS.ACTIVE,
			})
			.select('userId')
			.lean()

		const currentWorkerIds = currentBuildingMembers.map(member =>
			member.userId.toString(),
		)

		const workerIdsToUnassign = currentWorkerIds.filter(
			id => !selectedWorkerIds.includes(id),
		)

		if (workerIdsToUnassign.length) {
			await Promise.all([
				this.buildingWorkerSchema.updateMany(
					{
						companyId: targetCompanyId,
						buildingId,
						userId: { $in: workerIdsToUnassign },
					},
					{
						$set: {
							status: MEMBER_STATUS.INACTIVE,
						},
					},
				),

				this.companyMemberSchema.updateMany(
					{
						companyId: targetCompanyId,
						memberId: { $in: workerIdsToUnassign },
					},
					{
						$set: {
							status: MEMBER_STATUS.INACTIVE,
						},
					},
				),
			])
		}

		for (const workerId of selectedWorkerIds) {
			const companyMember = await this.companyMemberSchema.findOne({
				companyId: targetCompanyId,
				memberId: workerId,
			})

			if (!companyMember) continue

			await this.buildingWorkerSchema.findOneAndUpdate(
				{
					companyId: targetCompanyId,
					buildingId,
					userId: workerId,
				},
				{
					$set: {
						companyId: targetCompanyId,
						buildingId,
						userId: workerId,
						status: MEMBER_STATUS.ACTIVE,
					},
				},
				{
					upsert: true,
					new: true,
				},
			)

			await this.companyMemberSchema.updateOne(
				{
					_id: companyMember._id,
				},
				{
					$set: {
						status: MEMBER_STATUS.ACTIVE,
					},
				},
			)
		}

		return {
			message: 'Workers updated successfully',
		}
	}

	async createAdminBuildingWorker({ buildingId, payload }) {
		this.checkObjectId(buildingId, 'buildingId')

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const targetCompanyId = building.companyId

		const { name, email, phone, password, passwordConfirm } = payload

		if (!name || !email || !phone || !password || !passwordConfirm) {
			throw this.createError(400, 'All fields are required')
		}

		if (password !== passwordConfirm) {
			throw this.createError(400, 'Passwords do not match')
		}

		const existingUser = await this.userSchema.findOne({ email }).lean()

		if (existingUser) {
			throw this.createError(409, 'User already exists')
		}

		const hashedPassword = await bcrypt.hash(password, 10)

		const createdUser = await this.userSchema.create({
			name,
			email,
			phone,
			userType: 'worker',
			password: hashedPassword,
		})

		await this.companyMemberSchema.create({
			companyId: targetCompanyId,
			memberId: createdUser._id,
			memberRole: COMPANY_MEMBER_TYPES.worker,
			status: COMPANY_STATUS.ACTIVE,
		})

		return {
			_id: createdUser._id,
			name: createdUser.name,
			email: createdUser.email,
			phone: createdUser.phone,
			userType: createdUser.userType,
			checked: true,
			assignedBuildingId: buildingId,
		}
	}

	//  ===================================================== //

	normalizeNodeType(nodeType) {
		if (!nodeType) {
			throw this.createError(400, 'nodeType is required')
		}

		const value = String(nodeType).toLowerCase()

		const nodeTypeMap = {
			door_node: NODE_TYPE.DOOR,
			angle_node: NODE_TYPE.ANGLE,
			gangform_node: NODE_TYPE.GANGFORM,
		}

		const normalizedNodeType = nodeTypeMap[value]

		if (!normalizedNodeType) {
			throw this.createError(400, 'Invalid nodeType')
		}

		return normalizedNodeType
	}

	getNodeSelectFieldsByType(nodeType) {
		const baseFields = [
			'_id',
			'number',
			'nodeType',
			'companyId',
			'gatewayId',
			'status',
			'installedLocation',
			'installLocationImg',
			'isAssigned',
			'saveStatus',
			'saveStatusLastChange',
			'lastSeen',
			// 'createdAt',
			// 'updatedAt',
		]

		const doorFields = ['doorState', 'batteryLevel']

		const angleFields = ['angleX', 'angleY', 'calibratedX', 'calibratedY']

		const gangformFields = ['angleX', 'angleY']

		if (nodeType === NODE_TYPE.DOOR) {
			return [...baseFields, ...doorFields].join(' ')
		}

		if (nodeType === NODE_TYPE.ANGLE) {
			return [...baseFields, ...angleFields].join(' ')
		}

		if (nodeType === NODE_TYPE.GANGFORM) {
			return [...baseFields, ...gangformFields].join(' ')
		}

		throw this.createError(400, 'Invalid nodeType')
	}

	async getManagerBuildingNodesByType({
		userId,
		companyId = null,
		buildingId,
		nodeType,
	}) {
		const membership = await this.getAuthorizedManagerMembership({
			userId,
			companyId,
		})

		const targetCompanyId = membership.companyId

		this.checkObjectId(buildingId, 'buildingId')

		const normalizedNodeType = this.normalizeNodeType(nodeType)

		const building = await this.buildingSchema
			.findOne({
				_id: buildingId,
				companyId: targetCompanyId,
			})
			.lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const gatewaysList = await this.gatewaySchema
			.find({
				companyId: targetCompanyId,
				buildingId,
				isAssigned: true,
			})
			.sort({ createdAt: -1 })
			.lean()

		const gatewayIds = gatewaysList.map(gateway => gateway._id)

		const selectFields = this.getNodeSelectFieldsByType(normalizedNodeType)

		const nodesList = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId: targetCompanyId,
						gatewayId: { $in: gatewayIds },
						nodeType: normalizedNodeType,
						isAssigned: true,
					})
					.select(selectFields)
					.sort({ number: 1 })
					.lean()
			: []

		const alarmLevels = await this.alarmLevelSchema
			.find({
				buildingId,
				alarmType: normalizedNodeType,
			})
			.lean()

		return {
			nodeType: normalizedNodeType,
			nodesList,
			gatewaysList,
			alarmLevels,
		}
	}

	async getAdminCompanyBuildingNodesPage({ companyId, buildingId, nodeType }) {
		this.checkObjectId(companyId, 'companyId')
		this.checkObjectId(buildingId, 'buildingId')

		if (!nodeType) {
			throw this.createError(400, 'nodeType is required')
		}

		const targetCompanyId = companyId
		const targetBuildingId = buildingId

		const building = await this.buildingSchema
			.findOne({
				_id: targetBuildingId,
				companyId: targetCompanyId,
			})
			.lean()

		if (!building) {
			throw this.createError(404, 'Building not found')
		}

		const [gatewayList, buildingAlarmLevel] = await Promise.all([
			this.gatewaySchema
				.find({
					companyId: targetCompanyId,
					buildingId: targetBuildingId,
					isAssigned: true,
				})
				.sort({ createdAt: -1 })
				.lean(),

			this.alarmLevelSchema
				.findOne({
					buildingId: targetBuildingId,
					alarmType: nodeType,
				})
				.lean(),
		])

		const gatewayIds = gatewayList.map(gateway => gateway._id)

		const nodesList = gatewayIds.length
			? await this.nodeSchema
					.find({
						companyId: targetCompanyId,
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
				buildingId: targetBuildingId,
				alarmType: nodeType,
				blue: 0,
				green: 0,
				yellow: 0,
				red: 0,
			},
		}
	}

	validateAlarmLevelPayload({ buildingId, alarmType, green, yellow, red }) {
		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		if (!alarmType) {
			throw this.createError('alarmType is required', 400)
		}

		if (!Object.values(ALARM_NODE_TYPES).includes(alarmType)) {
			throw this.createError('Invalid alarm type', 400)
		}

		const values = { green, yellow, red }
		const ALARM_MAX_DEGREE = 12

		for (const [key, value] of Object.entries(values)) {
			if (
				typeof value !== 'number' ||
				Number.isNaN(value) ||
				value < 0 ||
				value > ALARM_MAX_DEGREE
			) {
				throw this.createError(
					`${key} must be a number between 0 and ${ALARM_MAX_DEGREE}`,
					400,
				)
			}
		}

		// 0 degani disabled/default sifatida qabul qilinyapti.
		// Shuning uchun 0 bo‘lsa comparison skip qilamiz.
		if (green !== 0 && yellow !== 0 && green > yellow) {
			throw this.createError('green cannot be greater than yellow', 400)
		}

		if (yellow !== 0 && red !== 0 && yellow > red) {
			throw this.createError('yellow cannot be greater than red', 400)
		}
	}

	async updateBuildingAlarmLevel({
		buildingId,
		alarmType,
		green,
		yellow,
		red,
	}) {
		this.validateAlarmLevelPayload({
			buildingId,
			alarmType,
			green,
			yellow,
			red,
		})

		const alarmLevel = await this.alarmLevelSchema.findOneAndUpdate(
			{
				buildingId,
				alarmType,
			},
			{
				$set: {
					green,
					yellow,
					red,
				},
				$setOnInsert: {
					buildingId,
					alarmType,
				},
			},
			{
				new: true,
				upsert: true,
				runValidators: true,
			},
		)

		return alarmLevel
	}
}

module.exports = AdminBuildingsService
