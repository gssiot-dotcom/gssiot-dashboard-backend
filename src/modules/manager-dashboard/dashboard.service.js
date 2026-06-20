// services/ManagerDashboardService.js

const mongoose = require('mongoose')
const {
	COMPANY_MEMBER_TYPES,
	NODE_TYPE,
	COMPANY_STATUS,
	MEMBER_STATUS,
	BUILDING_STATUS,
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
	GatewayAlarmSettingSchema,
} = require('../building/building.model')
const GatewaySchema = require('../gateways/gateway.model')
const NodeSchema = require('../nodes/node.model')
const bcryptjs = require('bcryptjs')
const { UserSchema } = require('../users/user.model')
const {
	sendAlarmLevelToGateways,
	sendFaultFilterToGateway,
} = require('../building/alarm-level-mqtt.helper')

class ManagerDashboardService {
	constructor() {
		this.userSchema = UserSchema
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.gatewaySchema = GatewaySchema
		this.nodeSchema = NodeSchema
		this.alarmLevelSchema = BuildingAlarmLevelSchema
		this.gatewayAlarmSettingSchema = GatewayAlarmSettingSchema
	}
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

	async getAuthorizedManagerMembership({ userId, companyId = null }) {
		this.checkObjectId(userId, 'userId')

		const managerRole = COMPANY_MEMBER_TYPES.manager

		const query = {
			memberId: userId,
			status: MEMBER_STATUS.ACTIVE,
		}

		if (companyId) {
			this.checkObjectId(companyId, 'companyId')
			query.companyId = companyId
		}

		if (managerRole.length) {
			query.memberRole = { $in: managerRole }
		}

		const membership = await this.companyMemberSchema.findOne(query).lean()

		if (!membership) {
			throw this.createError(
				'You do not have manager permission for this company',
				403,
			)
		}

		return membership
	}

	async getMyCompany({ userId }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const company = await this.companySchema.findById(companyId).lean()
		if (!company) throw this.createError('Company not found', 404)

		return company
	}

	// ===================== Buildings page services ===================== //
	async getManagerDashboard({ userId }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const company = await this.companySchema.findById(companyId).lean()
		if (!company) throw this.createError('Company not found', 404)

		const managerRole = COMPANY_MEMBER_TYPES.manager
		const workerRole = COMPANY_MEMBER_TYPES.worker

		const [buildingsList, companyMembersList, gatewaysList, nodesStatsAgg] =
			await Promise.all([
				this.buildingSchema.find({ companyId }).sort({ createdAt: -1 }).lean(),

				this.companyMemberSchema
					.find({ companyId })
					.populate({
						path: 'memberId',
						select: '_id name email phone userType',
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.gatewaySchema
					.find({ companyId, isAssigned: true })
					.sort({ createdAt: -1 })
					.lean(),

				this.nodeSchema.aggregate([
					{ $match: { companyId, isAssigned: true } },
					{
						$group: {
							_id: '$companyId',
							nodesCount: { $sum: 1 },
							onlineNodesCount: {
								$sum: {
									$cond: [
										{
											$ne: [
												{ $toLower: { $ifNull: ['$status', ''] } },
												'offline',
											],
										},
										1,
										0,
									],
								},
							},
							warningNodesCount: {
								$sum: {
									$cond: [
										{
											$in: [
												{ $toLower: { $ifNull: ['$status', ''] } },
												['warning', 'danger'],
											],
										},
										1,
										0,
									],
								},
							},
						},
					},
				]),
			])

		const nodesStats = nodesStatsAgg[0] || {
			nodesCount: 0,
			onlineNodesCount: 0,
			warningNodesCount: 0,
		}

		const managersCount = companyMembersList.filter(
			m => m.memberRole === managerRole,
		).length
		const workersCount = companyMembersList.filter(
			m => m.memberRole === workerRole,
		).length

		return {
			company,
			companyStatistics: {
				buildingsCount: buildingsList.length,
				managersCount,
				workersCount,
				gatewaysCount: gatewaysList.length,
				nodesCount: nodesStats.nodesCount,
				onlineNodesCount: nodesStats.onlineNodesCount,
				warningNodesCount: nodesStats.warningNodesCount,
			},
			buildingsList,
			companyMembersList,
			gatewaysList,
		}
	}

	async getManagerCompanyMembers({ userId, memberRole, search = '' }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const query = { companyId }

		if (memberRole) query.memberRole = memberRole

		if (search) {
			const regex = new RegExp(search, 'i')
			query.$or = [
				{ 'memberId.name': regex },
				{ 'memberId.email': regex },
				{ 'memberId.phone': regex },
			]
		}

		const members = await this.companyMemberSchema
			.find(query)
			.populate({
				path: 'memberId',
				select: '_id name email phone userType isAssigned',
			})
			.sort({ createdAt: -1 })
			.lean()

		return members.map(member => {
			const user = member.memberId
			return {
				id: user?._id,
				_id: user?._id,
				companyMemberId: member._id,
				name: user?.name || '',
				email: user?.email || '',
				phone: user?.phone || '',
				type: user?.userType || '',
				memberRole: member.memberRole,
				status: member.status,
				checked: member.status === MEMBER_STATUS.ACTIVE,
				assigned: member.status === MEMBER_STATUS.ACTIVE,
			}
		})
	}

	async createManagerCompanyMemberUser({ userId, payload }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const {
			name,
			email,
			phone = '',
			userType,
			password,
			passwordConfirm,
		} = payload

		if (!name || !email || !password || !passwordConfirm) {
			throw this.createError('Please fill all required fields', 400)
		}

		if (password !== passwordConfirm) {
			throw this.createError('Password confirmation does not match', 400)
		}

		const normalizedEmail = email.trim().toLowerCase()
		const finalType = userType.toLowerCase()
		const session = await mongoose.startSession()

		try {
			let result = null

			await session.withTransaction(async () => {
				const existingUser = await this.userSchema
					.findOne({ email: normalizedEmail })
					.session(session)

				if (existingUser) throw this.createError('Email already exists', 409)

				const hashedPassword = await bcryptjs.hash(password, 10)

				const [createdUser] = await this.userSchema.create(
					[
						{
							name,
							email: normalizedEmail,
							phone,
							password: hashedPassword,
							userType: finalType,
							isAssigned: true,
						},
					],
					{ session },
				)

				const [createdCompanyMember] = await this.companyMemberSchema.create(
					[
						{
							companyId,
							memberId: createdUser._id,
							memberRole: finalType,
							status: MEMBER_STATUS.INACTIVE,
						},
					],
					{ session },
				)

				const userObject = createdUser.toObject()
				delete userObject.password

				result = {
					_id: createdUser._id,
					companyMemberId: createdCompanyMember._id,
					name: userObject.name,
					email: userObject.email,
					phone: userObject.phone,
					type: userObject.userType,
					memberRole: createdCompanyMember.memberRole,
					status: createdCompanyMember.status,
					isAssigned: true,
					checked: false,
					// assigned: true,
				}
			})

			return result
		} finally {
			session.endSession()
		}
	}

	async updateManagerCompanyMemberStatuses({ userId, activeMemberIds = [] }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		if (!Array.isArray(activeMemberIds)) {
			throw this.createError('activeMemberIds must be an array', 400)
		}

		const uniqueActiveMemberIds = [
			...new Set(activeMemberIds.map(id => id.toString())),
		]

		for (const memberId of uniqueActiveMemberIds) {
			if (!mongoose.Types.ObjectId.isValid(memberId)) {
				throw this.createError('Invalid member id', 400)
			}
		}

		const existingCount = await this.companyMemberSchema.countDocuments({
			companyId,
			memberId: { $in: uniqueActiveMemberIds },
		})

		if (existingCount !== uniqueActiveMemberIds.length) {
			throw this.createError('Some members do not belong to this company', 400)
		}

		await this.companyMemberSchema.updateMany(
			{ companyId, memberId: { $in: uniqueActiveMemberIds } },
			{ $set: { status: MEMBER_STATUS.ACTIVE } },
		)

		await this.companyMemberSchema.updateMany(
			{ companyId, memberId: { $nin: uniqueActiveMemberIds } },
			{ $set: { status: MEMBER_STATUS.INACTIVE } },
		)

		const updatedMembers = await this.getManagerCompanyMembers({ userId })

		return {
			members: updatedMembers,
			activeCount: updatedMembers.filter(m => m.checked).length,
			inactiveCount: updatedMembers.filter(m => !m.checked).length,
			totalCount: updatedMembers.length,
		}
	}

	async getManagerCompanyBuildings({ userId, search = '' }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const query = { companyId }

		if (search) {
			const regex = new RegExp(search, 'i')
			query.$or = [
				{ title: regex },
				{ address: regex },
				{ buildingType: regex },
			]
		}

		const buildings = await this.buildingSchema
			.find(query)
			.sort({ createdAt: -1 })
			.lean()

		return buildings.map(building => ({
			_id: building._id,
			title: building.title || '',
			address: building.address || '',
			buildingType: building.buildingType || '',
			companyId: building.companyId,
			buildingPlanImage: building.buildingPlanImage || [],
			buildingRealImage: building.buildingRealImage || [],
			buildingStatus: building.buildingStatus,
			startDate: building.startDate,
			createdAt: building.createdAt,
			updatedAt: building.updatedAt,
			checked: building.buildingStatus === BUILDING_STATUS.ACTIVE,
			assigned: building.buildingStatus === BUILDING_STATUS.ACTIVE,
			isAssigned: building.buildingStatus === BUILDING_STATUS.ACTIVE,
		}))
	}

	async createManagerBuilding({ userId, payload }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const title = payload.title?.trim()
		const address = payload.address?.trim()
		const buildingType = payload.buildingType?.trim()

		if (!title) throw this.createError('title is required', 400)
		if (!address) throw this.createError('address is required', 400)
		if (!buildingType) throw this.createError('buildingType is required', 400)

		const createdBuilding = await this.buildingSchema.create({
			title,
			address,
			buildingType,
			isAssigned: true,
			companyId,
		})

		return {
			...createdBuilding.toObject(),
			checked: true,
			assigned: true,
		}
	}

	async updateManagerCompanyBuildingStatuses({
		userId,
		activeBuildingIds = [],
	}) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		await this.buildingSchema.updateMany(
			{ companyId, _id: { $in: activeBuildingIds } },
			{ $set: { buildingStatus: BUILDING_STATUS.ACTIVE } },
		)

		await this.buildingSchema.updateMany(
			{ companyId, _id: { $nin: activeBuildingIds } },
			{ $set: { buildingStatus: BUILDING_STATUS.INACTIVE } },
		)

		return this.getManagerCompanyBuildings({ userId })
	}

	// ===================== Buildings page services ===================== //
	async getManagerCompanyBuildingsPage({ userId }) {
		const membership = await this.getAuthorizedManagerMembership({ userId })
		const companyId = membership.companyId

		const company = await this.companySchema.findOne({ _id: companyId }).lean()
		if (!company) throw this.createError('Company not found', 404)

		const buildings = await this.buildingSchema
			.find({ companyId })
			.sort({ createdAt: -1 })
			.lean()

		const buildingIds = buildings.map(b => b._id)

		if (!buildingIds.length) {
			return { buildingsList: [] }
		}

		const [buildingGateways, buildingWorkers] = await Promise.all([
			this.gatewaySchema
				.find({ companyId, buildingId: { $in: buildingIds }, isAssigned: true })
				.sort({ createdAt: -1 })
				.lean(),

			this.buildingWorkerSchema
				.find({ companyId, buildingId: { $in: buildingIds } })
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

		const buildingsList = buildings.map(building => ({
			...building,
			statistics: statsByBuildingId[building._id.toString()],
		}))

		return { buildingsList }
	}

	async checkManagerBuilding({ userId, buildingId }) {
		this.checkObjectId(buildingId, 'buildingId')
		const membership = await this.getAuthorizedManagerMembership({ userId })

		const building = await this.buildingSchema
			.findOne({
				_id: buildingId,
				companyId: membership.companyId,
			})
			.lean()

		if (!building) throw this.createError('Building not found', 404)

		return { building, companyId: membership.companyId }
	}

	async getManagerBuildingGateways({ userId, buildingId }) {
		const { building, companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		const [assignedGateways, unassignedGateways] = await Promise.all([
			this.gatewaySchema
				.find({ companyId, buildingId, isAssigned: true })
				.sort({ createdAt: -1 })
				.lean(),

			this.gatewaySchema
				.find({
					companyId,
					$or: [{ buildingId: null }, { buildingId: { $exists: false } }],
				})
				.sort({ createdAt: -1 })
				.lean(),
		])

		const gatewaysList = [
			...assignedGateways.map(gw => ({
				...gw,
				checked: true,
				assignedBuildingId: buildingId,
			})),
			...unassignedGateways.map(gw => ({
				...gw,
				checked: false,
				assignedBuildingId: null,
			})),
		]

		return { gatewaysList }
	}

	async updateManagerBuildingGateways({ userId, buildingId, gatewayIds = [] }) {
		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		if (!Array.isArray(gatewayIds))
			throw this.createError('gatewayIds must be an array', 400)
		for (const id of gatewayIds) this.checkObjectId(id, 'gatewayId')

		const currentGateways = await this.gatewaySchema
			.find({ companyId, buildingId, isAssigned: true })
			.select('_id')
			.lean()

		const currentGatewayIds = currentGateways.map(gw => gw._id.toString())
		const selectedGatewayIds = gatewayIds.map(id => id.toString())

		const gatewayIdsToUnassign = currentGatewayIds.filter(
			id => !selectedGatewayIds.includes(id),
		)

		if (gatewayIdsToUnassign.length) {
			await this.gatewaySchema.updateMany(
				{ _id: { $in: gatewayIdsToUnassign }, companyId, buildingId },
				{ $set: { buildingId: null } },
			)
		}

		if (selectedGatewayIds.length) {
			await this.gatewaySchema.updateMany(
				{
					_id: { $in: selectedGatewayIds },
					companyId,
					$or: [
						{ buildingId },
						{ buildingId: null },
						{ buildingId: { $exists: false } },
					],
				},
				{ $set: { buildingId } },
			)
		}

		return { message: 'Gateways updated successfully' }
	}

	async getManagerBuildingWorkers({ userId, buildingId }) {
		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		const workerRole = COMPANY_MEMBER_TYPES.worker

		const assignedBuildingMembers = await this.buildingWorkerSchema
			.find({ companyId, buildingId, status: MEMBER_STATUS.ACTIVE })
			.populate({ path: 'userId', select: '_id name email phone userType' })
			.sort({ createdAt: -1 })
			.lean()

		const assignedUserIds = assignedBuildingMembers
			.map(m => m.userId?._id?.toString())
			.filter(Boolean)

		const inactiveCompanyMembers = await this.companyMemberSchema
			.find({
				companyId,
				memberRole: workerRole,
				status: MEMBER_STATUS.INACTIVE,
				memberId: { $nin: assignedUserIds },
			})
			.populate({ path: 'memberId', select: '_id name email phone userType' })
			.sort({ createdAt: -1 })
			.lean()

		const workersList = [
			...assignedBuildingMembers
				.filter(m => m.userId)
				.map(m => ({
					_id: m.userId._id,
					name: m.userId.name,
					email: m.userId.email,
					phone: m.userId.phone,
					userType: m.userId.userType,
					checked: true,
					assignedBuildingId: buildingId,
					buildingMemberId: m._id,
				})),

			...inactiveCompanyMembers
				.filter(m => m.memberId)
				.map(m => ({
					_id: m.memberId._id,
					name: m.memberId.name,
					email: m.memberId.email,
					phone: m.memberId.phone,
					userType: m.memberId.userType,
					checked: false,
					assignedBuildingId: null,
					companyMemberId: m._id,
				})),
		]

		return { workersList }
	}

	async updateManagerBuildingWorkers({ userId, buildingId, workerIds = [] }) {
		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		if (!Array.isArray(workerIds))
			throw this.createError('workerIds must be an array', 400)
		for (const id of workerIds) this.checkObjectId(id, 'workerId')

		const selectedWorkerIds = workerIds.map(id => id.toString())

		const currentBuildingMembers = await this.buildingWorkerSchema
			.find({ companyId, buildingId, status: MEMBER_STATUS.ACTIVE })
			.select('userId')
			.lean()

		const currentWorkerIds = currentBuildingMembers.map(m =>
			m.userId.toString(),
		)
		const workerIdsToUnassign = currentWorkerIds.filter(
			id => !selectedWorkerIds.includes(id),
		)

		if (workerIdsToUnassign.length) {
			await Promise.all([
				this.buildingWorkerSchema.updateMany(
					{ companyId, buildingId, userId: { $in: workerIdsToUnassign } },
					{ $set: { status: MEMBER_STATUS.INACTIVE } },
				),
				this.companyMemberSchema.updateMany(
					{ companyId, memberId: { $in: workerIdsToUnassign } },
					{ $set: { status: MEMBER_STATUS.INACTIVE } },
				),
			])
		}

		for (const workerId of selectedWorkerIds) {
			const companyMember = await this.companyMemberSchema.findOne({
				companyId,
				memberId: workerId,
			})
			if (!companyMember) continue

			await this.buildingWorkerSchema.findOneAndUpdate(
				{ companyId, buildingId, userId: workerId },
				{
					$set: {
						companyId,
						buildingId,
						userId: workerId,
						status: MEMBER_STATUS.ACTIVE,
					},
				},
				{ upsert: true, new: true },
			)

			await this.companyMemberSchema.updateOne(
				{ _id: companyMember._id },
				{ $set: { status: MEMBER_STATUS.ACTIVE } },
			)
		}

		return { message: 'Workers updated successfully' }
	}

	async createManagerBuildingWorker({ userId, buildingId, payload }) {
		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		const { name, email, phone, password, passwordConfirm } = payload

		if (!name || !email || !phone || !password || !passwordConfirm) {
			throw this.createError('All fields are required', 400)
		}

		if (password !== passwordConfirm)
			throw this.createError('Passwords do not match', 400)

		const existingUser = await this.userSchema.findOne({ email }).lean()
		if (existingUser) throw this.createError('User already exists', 409)
		const hashedPassword = await bcryptjs.hash(password, 10)

		const createdUser = await this.userSchema.create({
			name,
			email,
			phone,
			userType: 'worker',
			password: hashedPassword,
		})

		await this.companyMemberSchema.create({
			companyId,
			memberId: createdUser._id,
			memberRole: COMPANY_MEMBER_TYPES.worker,
			status: MEMBER_STATUS.ACTIVE,
		})
		await this.buildingWorkerSchema.create({
			companyId,
			userId: createdUser._id,
			buildingId,
			status: MEMBER_STATUS.ACTIVE,
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

	// ===================== Nodes page services ===================== //
	async getManagerBuildingNodesPage({ userId, buildingId, nodeType }) {
		const { companyId } = await this.checkManagerBuilding({
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

		const [nodesList, gatewayAlarmSettings] = await Promise.all([
			gatewayIds.length
				? this.nodeSchema
						.find({
							companyId,
							gatewayId: { $in: gatewayIds },
							nodeType,
							isAssigned: true,
						})
						.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
						.sort({ number: 1 })
						.lean()
				: [],

			gatewayIds.length
				? this.gatewayAlarmSettingSchema
						.find({ gatewayId: { $in: gatewayIds } })
						.lean()
				: [],
		])

		return {
			nodesList,
			gatewayList,
			gatewayAlarmSettings,
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

	validateAlarmLevelPayload({
		buildingId,
		alarmType,
		green,
		yellow,
		red,
		enabled = true,
	}) {
		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		if (!alarmType) {
			throw this.createError('alarmType is required', 400)
		}

		if (!Object.values(ALARM_NODE_TYPES).includes(alarmType)) {
			throw this.createError('Invalid alarm type', 400)
		}

		if (enabled === false) return

		if (alarmType === NODE_TYPE.DOOR) return

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
		userId,
		buildingId,
		gatewayId = null,
		enabled = true,
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
			enabled,
		})

		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		const gatewayQuery = {
			companyId,
			buildingId,
			isAssigned: true,
		}

		if (gatewayId) {
			this.checkObjectId(gatewayId, 'gatewayId')
			gatewayQuery._id = gatewayId
		}

		const gateways = await this.gatewaySchema
			.find(gatewayQuery)
			.select('_id serialNumber')
			.lean()

		const mqttResult = await sendAlarmLevelToGateways({
			gateways,
			alarmType,
			green,
			yellow,
			red,
			enabled,
		})

		if (mqttResult.summary.successCount === 0) {
			const statusCode =
				mqttResult.summary.timeoutCount === mqttResult.summary.total ? 504 : 400
			const message =
				statusCode === 504
					? 'MQTT response timeout'
					: 'Failed setting alarm level on all gateways'
			const error = this.createError(message, statusCode)
			error.data = {
				gatewayResults: mqttResult.results,
				summary: mqttResult.summary,
			}
			throw error
		}

		await this.saveGatewayAlarmSettings({
			gatewayResults: mqttResult.results,
			alarmType,
			green,
			yellow,
			red,
			enabled,
			updatedBy: userId,
		})

		const alarmLevel =
			enabled === false
				? null
				: await this.alarmLevelSchema.findOneAndUpdate(
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

		return {
			alarmLevel,
			gatewayResults: mqttResult.results,
			summary: mqttResult.summary,
		}
	}

	getGatewayAlarmSettingPath(alarmType) {
		if (alarmType === NODE_TYPE.DOOR) return 'door'
		return alarmType === NODE_TYPE.ANGLE ? 'angle' : 'vertical'
	}

	async saveGatewayAlarmSettings({
		gatewayResults,
		alarmType,
		green,
		yellow,
		red,
		enabled,
		updatedBy = null,
	}) {
		const settingPath = this.getGatewayAlarmSettingPath(alarmType)
		const successResults = gatewayResults.filter(
			result => result.status === 'success' && result.gatewayId,
		)

		await Promise.all(
			successResults.map(result =>
				this.gatewayAlarmSettingSchema.findOneAndUpdate(
					{ gatewayId: result.gatewayId },
					{
						$set: {
							gatewayId: result.gatewayId,
							gatewaySerialNum: result.gatewaySerialNum,
							updatedBy,
							[`${settingPath}.alarmEnabled`]: enabled,
							[`${settingPath}.alarmLevel1`]: enabled ? green : null,
							[`${settingPath}.alarmLevel2`]: enabled ? yellow : null,
							[`${settingPath}.alarmLevel3`]: enabled ? red : null,
						},
						$setOnInsert: {
							[`${settingPath}.faultFilterNodes`]: [],
						},
					},
					{
						new: true,
						upsert: true,
						runValidators: true,
					},
				),
			),
		)
	}

	validateFaultFilterPayload({
		buildingId,
		gatewayId,
		alarmType,
		nodeNumber,
		nodes,
		enabled,
	}) {
		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		this.checkObjectId(gatewayId, 'gatewayId')

		if (!alarmType) {
			throw this.createError('alarmType is required', 400)
		}

		if (!Object.values(ALARM_NODE_TYPES).includes(alarmType)) {
			throw this.createError('Invalid alarm type', 400)
		}

		if (Array.isArray(nodes)) {
			this.normalizeFaultFilterNodes(nodes)
			return
		}

		if (typeof enabled !== 'boolean') {
			throw this.createError('enabled is required', 400)
		}

		this.normalizeFaultFilterNodeNumber(nodeNumber)
	}

	normalizeFaultFilterNodeNumber(nodeNumber) {
		const normalized = Number(nodeNumber)

		if (
			!Number.isInteger(normalized) ||
			normalized < 1 ||
			normalized > 9999
		) {
			throw this.createError('nodeNumber must be a valid node number', 400)
		}

		return normalized
	}

	normalizeFaultFilterNodes(nodes = []) {
		if (!Array.isArray(nodes)) {
			throw this.createError('nodes must be an array', 400)
		}

		return [
			...new Set(
				nodes.map(nodeNumber =>
					this.normalizeFaultFilterNodeNumber(nodeNumber),
				),
			),
		].sort((a, b) => a - b)
	}

	resolveFaultFilterNodes({ currentNodes, nodes, nodeNumber, enabled }) {
		if (Array.isArray(nodes)) {
			return this.normalizeFaultFilterNodes(nodes)
		}

		const normalizedNodeNumber =
			this.normalizeFaultFilterNodeNumber(nodeNumber)
		const nextNodes = new Set(this.normalizeFaultFilterNodes(currentNodes))

		if (enabled) {
			nextNodes.add(normalizedNodeNumber)
		} else {
			nextNodes.delete(normalizedNodeNumber)
		}

		return [...nextNodes].sort((a, b) => a - b)
	}

	async updateFaultFilter({
		userId,
		buildingId,
		gatewayId,
		alarmType,
		nodeNumber,
		nodes,
		enabled = true,
	}) {
		this.validateFaultFilterPayload({
			buildingId,
			gatewayId,
			alarmType,
			nodeNumber,
			nodes,
			enabled,
		})

		const { companyId } = await this.checkManagerBuilding({
			userId,
			buildingId,
		})

		const gateway = await this.gatewaySchema
			.findOne({
				_id: gatewayId,
				companyId,
				buildingId,
				isAssigned: true,
			})
			.select('_id serialNumber')
			.lean()

		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		const settingPath = this.getGatewayAlarmSettingPath(alarmType)
		const currentSetting = await this.gatewayAlarmSettingSchema
			.findOne({ gatewayId })
			.lean()
		const currentNodes =
			currentSetting?.[settingPath]?.faultFilterNodes || []
		const faultFilterNodes = this.resolveFaultFilterNodes({
			currentNodes,
			nodes,
			nodeNumber,
			enabled,
		})

		const mqttResult = await sendFaultFilterToGateway({
			gateway,
			alarmType,
			nodes: faultFilterNodes,
		})

		if (mqttResult.summary.successCount === 0) {
			const statusCode =
				mqttResult.summary.timeoutCount === mqttResult.summary.total ? 504 : 400
			const message =
				statusCode === 504
					? 'MQTT response timeout'
					: 'Failed setting fault filter on gateway'
			const error = this.createError(message, statusCode)
			error.data = {
				gatewayResults: mqttResult.results,
				summary: mqttResult.summary,
			}
			throw error
		}

		await this.gatewayAlarmSettingSchema.findOneAndUpdate(
			{ gatewayId },
			{
				$set: {
					gatewayId,
					gatewaySerialNum: gateway.serialNumber,
					updatedBy: userId,
					[`${settingPath}.faultFilterNodes`]: faultFilterNodes,
				},
			},
			{
				new: true,
				upsert: true,
				runValidators: true,
			},
		)

		return {
			faultFilterNodes,
			gatewayResults: mqttResult.results,
			summary: mqttResult.summary,
		}
	}
}

module.exports = ManagerDashboardService
