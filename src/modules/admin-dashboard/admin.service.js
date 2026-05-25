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
const {
	COMPANY_STATUS,
	COMPANY_MEMBER_TYPES,
	MEMBER_STATUS,
	BUILDING_STATUS,
	NODE_TYPE,
} = require('../../lib/config')
const { buildPaginationMeta } = require('../../utils/pagination')
const { default: mongoose } = require('mongoose')
const { UserSchema } = require('../users/user.model')
const bcrypt = require('bcryptjs')
const { getMqttClient } = require('../../infrastructure/mqtt')
const { eventBus } = require('../../shared/eventBus')
const { logger } = require('../../lib/logger')

class AdminDashboardService {
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

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	createPaginationMeta({ total, page, limit }) {
		return {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
			hasNextPage: page < Math.ceil(total / limit),
			hasPrevPage: page > 1,
		}
	}

	async getAdminDashboard({ page = 1, limit = 20, skip = 0, search = '' }) {
		const companyFilter = {
			companyStatus: COMPANY_STATUS.ACTIVE,
		}

		if (search) {
			companyFilter.$or = [
				{ companyName: { $regex: search, $options: 'i' } },
				{ companyEmail: { $regex: search, $options: 'i' } },
				{ companyPhone: { $regex: search, $options: 'i' } },
			]
		}

		const [companies, totalItems] = await Promise.all([
			this.companySchema
				.find(companyFilter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.companySchema.countDocuments(companyFilter),
		])

		const companyIds = companies.map(company => company._id)

		if (!companyIds.length) {
			return {
				companies: [],
				pagination: buildPaginationMeta({
					page,
					limit,
					totalItems,
				}),
			}
		}

		const managerRole = COMPANY_MEMBER_TYPES.manager
		const workerRole = COMPANY_MEMBER_TYPES.worker

		const [buildingsList, companyMembersList, gatewaysList, nodesStatsAgg] =
			await Promise.all([
				this.buildingSchema
					.find({
						companyId: { $in: companyIds },
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.companyMemberSchema
					.find({
						companyId: { $in: companyIds },
					})
					.populate({
						path: 'memberId',
						select: '_id name email phone userType',
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.gatewaySchema
					.find({
						companyId: { $in: companyIds },
						isAssigned: true,
					})
					.sort({ createdAt: -1 })
					.lean(),

				this.nodeSchema.aggregate([
					{
						$match: {
							companyId: { $in: companyIds },
							isAssigned: true,
						},
					},
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

		const groupByCompanyId = items => {
			return items.reduce((acc, item) => {
				const key = item.companyId?.toString()

				if (!key) {
					return acc
				}

				if (!acc[key]) {
					acc[key] = []
				}

				acc[key].push(item)

				return acc
			}, {})
		}

		const buildingsByCompany = groupByCompanyId(buildingsList)
		const membersByCompany = groupByCompanyId(companyMembersList)
		const gatewaysByCompany = groupByCompanyId(gatewaysList)

		const nodesStatsByCompany = nodesStatsAgg.reduce((acc, item) => {
			acc[item._id.toString()] = {
				nodesCount: item.nodesCount || 0,
				onlineNodesCount: item.onlineNodesCount || 0,
				warningNodesCount: item.warningNodesCount || 0,
			}

			return acc
		}, {})

		const companiesDashboardList = companies.map(company => {
			const companyId = company._id.toString()

			const currentBuildingsList = buildingsByCompany[companyId] || []
			const currentMembersList = membersByCompany[companyId] || []
			const currentGatewaysList = gatewaysByCompany[companyId] || []
			const currentNodesStats = nodesStatsByCompany[companyId] || {
				nodesCount: 0,
				onlineNodesCount: 0,
				warningNodesCount: 0,
			}

			const activeMembers = currentMembersList.filter(
				member => member.status === MEMBER_STATUS.ACTIVE,
			)

			const managersCount = currentMembersList.filter(
				member => member.memberRole === managerRole,
			).length

			const workersCount = currentMembersList.filter(
				member => member.memberRole === workerRole,
			).length

			return {
				company,

				companyStatistics: {
					buildingsCount: currentBuildingsList.length,
					managersCount,
					workersCount,
					gatewaysCount: currentGatewaysList.length,

					nodesCount: currentNodesStats.nodesCount,
					onlineNodesCount: currentNodesStats.onlineNodesCount,
					warningNodesCount: currentNodesStats.warningNodesCount,
				},

				buildingsList: currentBuildingsList,
				companyMembersList: currentMembersList,
				gatewaysList: currentGatewaysList,
			}
		})

		return {
			companies: companiesDashboardList,

			pagination: buildPaginationMeta({
				page,
				limit,
				totalItems,
			}),
		}
	}

	validateObjectId(id, message = 'Invalid id') {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(message, 400)
		}
	}

	async checkActiveCompany(companyId) {
		this.validateObjectId(companyId, 'Invalid company id')

		const company = await this.companySchema
			.findOne({
				_id: companyId,
				companyStatus: COMPANY_STATUS.ACTIVE,
			})
			.lean()

		if (!company) {
			throw this.createError('Company not found or inactive', 404)
		}

		return company
	}

	normalizeMemberRole(memberRole) {
		if (!memberRole) {
			return null
		}

		const role = memberRole.toString().toLowerCase()

		if (role === 'manager') {
			return COMPANY_MEMBER_TYPES.manager
		}

		if (role === 'worker') {
			return COMPANY_MEMBER_TYPES.worker
		}

		throw this.createError('Invalid member role', 400)
	}

	getUserTypeFromPayload(type) {
		if (!type) {
			throw this.createError('User type is required', 400)
		}

		const value = type.toString()

		if (value.toLowerCase() === 'manager') {
			return 'manager'
		}

		if (value.toLowerCase() === 'worker') {
			return 'worker'
		}

		throw this.createError('Invalid user type', 400)
	}

	getMemberRoleByUserType(userType) {
		if (userType.toLowerCase() === 'manager') {
			return COMPANY_MEMBER_TYPES.manager
		}

		if (userType.toLowerCase() === 'worker') {
			return COMPANY_MEMBER_TYPES.worker
		}

		throw this.createError('Invalid user type', 400)
	}

	async getCompanyMembers({ companyId }) {
		await this.checkActiveCompany(companyId)

		const members = await this.companyMemberSchema
			.find({ companyId })
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

	async createCompanyMemberUser({ companyId, payload }) {
		await this.checkActiveCompany(companyId)

		const {
			name,
			email,
			phone = '',
			userType,
			password,
			passwordConfirm,
		} = payload

		const finalUserType = this.getUserTypeFromPayload(userType)
		const memberRole = this.getMemberRoleByUserType(finalUserType)

		if (!name || !email || !password || !passwordConfirm) {
			throw this.createError('Please fill all required fields', 400)
		}

		if (password !== passwordConfirm) {
			throw this.createError('Password confirmation does not match', 400)
		}

		const normalizedEmail = email.trim().toLowerCase()

		const session = await mongoose.startSession()

		try {
			let result = null

			await session.withTransaction(async () => {
				const existingUser = await this.userSchema
					.findOne({ email: normalizedEmail })
					.session(session)

				if (existingUser) {
					throw this.createError('Email already exists', 409)
				}

				const hashedPassword = await bcrypt.hash(password, 10)

				const [createdUser] = await this.userSchema.create(
					[
						{
							name: name,
							email: normalizedEmail,
							phone,
							password: hashedPassword,
							userType: finalUserType,
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
							memberRole,
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
					isAssigned: createdCompanyMember._id ? true : false,

					checked: false,
					// assigned: true,
				}
			})

			return result
		} finally {
			session.endSession()
		}
	}

	async updateCompanyMemberStatuses({ companyId, activeMemberIds = [] }) {
		await this.checkActiveCompany(companyId)

		if (!Array.isArray(activeMemberIds)) {
			throw this.createError('activeMemberIds must be an array', 400)
		}

		const uniqueActiveMemberIds = [
			...new Set(activeMemberIds.map(id => id.toString())),
		]

		for (const memberId of uniqueActiveMemberIds) {
			this.validateObjectId(memberId, 'Invalid member id')
		}

		const existingActiveMembersCount =
			await this.companyMemberSchema.countDocuments({
				companyId,
				memberId: { $in: uniqueActiveMemberIds },
			})

		if (existingActiveMembersCount !== uniqueActiveMemberIds.length) {
			throw this.createError('Some members do not belong to this company', 400)
		}

		await this.companyMemberSchema.updateMany(
			{
				companyId,
				memberId: { $in: uniqueActiveMemberIds },
			},
			{
				$set: {
					status: MEMBER_STATUS.ACTIVE,
				},
			},
		)

		await this.companyMemberSchema.updateMany(
			{
				companyId,
				memberId: { $nin: uniqueActiveMemberIds },
			},
			{
				$set: {
					status: MEMBER_STATUS.INACTIVE,
				},
			},
		)

		const updatedMembers = await this.getCompanyMembers({
			companyId,
		})

		return {
			members: updatedMembers,
			activeCount: updatedMembers.filter(member => member.checked).length,
			inactiveCount: updatedMembers.filter(member => !member.checked).length,
			totalCount: updatedMembers.length,
		}
	}

	async getCompanyBuildings({ companyId }) {
		await this.checkActiveCompany(companyId)

		const buildings = await this.buildingSchema
			.find({ companyId })
			.sort({ createdAt: -1 })
			.lean()

		return buildings.map(building => {
			return {
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
			}
		})
	}

	async createBuilding(payload = {}) {
		const title = payload.title?.trim()
		const address = payload.address?.trim()
		const buildingType = payload.buildingType?.trim()
		const companyId = payload.companyId

		if (!title) {
			throw this.createError('title is required', 400)
		}

		if (!address) {
			throw this.createError('address is required', 400)
		}

		if (!buildingType) {
			throw this.createError('buildingType is required', 400)
		}

		if (companyId && !mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid companyId', 400)
		}

		const createdBuilding = await this.buildingSchema.create({
			title,
			address,
			buildingType,
			isAssigned: !!companyId,
			companyId: companyId || null,
		})

		const result = {
			...createdBuilding.toObject(),
			checked: true,
			assigned: true,
		}

		return result
	}

	async updateCompanyBuildingStatuses({ companyId, activeBuildingIds = [] }) {
		await this.checkActiveCompany(companyId)

		await this.buildingSchema.updateMany(
			{
				companyId,
				_id: { $in: activeBuildingIds },
			},
			{
				$set: {
					buildingStatus: BUILDING_STATUS.ACTIVE,
				},
			},
		)

		await this.buildingSchema.updateMany(
			{
				companyId,
				_id: { $nin: activeBuildingIds },
			},
			{
				$set: {
					buildingStatus: BUILDING_STATUS.INACTIVE,
				},
			},
		)

		return this.getCompanyBuildings({ companyId })
	}

	async getAdminOrganizationsTabs({ page, limit, skip }) {
		const [
			companiesList,
			companiesTotal,

			buildingsList,
			buildingsTotal,

			gatewaysList,
			gatewaysTotal,
		] = await Promise.all([
			this.companySchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.companySchema.countDocuments({}),

			this.buildingSchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
				.populate('companyId', 'companyName'),

			this.buildingSchema.countDocuments({}),

			this.gatewaySchema
				.find({})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean()
				.populate('companyId', 'companyName'),

			this.gatewaySchema.countDocuments({}),
		])

		return {
			companiesList: {
				items: companiesList,
				pagination: this.createPaginationMeta({
					total: companiesTotal,
					page,
					limit,
				}),
			},

			buildingsList: {
				items: buildingsList,
				pagination: this.createPaginationMeta({
					total: buildingsTotal,
					page,
					limit,
				}),
			},

			gatewaysList: {
				items: gatewaysList,
				pagination: this.createPaginationMeta({
					total: gatewaysTotal,
					page,
					limit,
				}),
			},
		}
	}

	async getAssigningResources({ page, limit, skip }) {
		const unassignedFilter = {
			isAssigned: false,
			$or: [{ companyId: { $exists: false } }, { companyId: null }],
		}

		const [buildingsList, buildingsTotal, gatewaysList, gatewaysTotal] =
			await Promise.all([
				this.buildingSchema
					.find(unassignedFilter)
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.lean(),

				this.buildingSchema.countDocuments(unassignedFilter),

				this.gatewaySchema
					.find(unassignedFilter)
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.lean(),

				this.gatewaySchema.countDocuments(unassignedFilter),
			])

		return {
			buildingsList: {
				items: buildingsList,
				pagination: this.createPaginationMeta({
					total: buildingsTotal,
					page,
					limit,
				}),
			},

			gatewaysList: {
				items: gatewaysList,
				pagination: this.createPaginationMeta({
					total: gatewaysTotal,
					page,
					limit,
				}),
			},
		}
	}

	// ============= Admin Device Service methods ============= //

	escapeRegex(value = '') {
		return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	normalizeGateway(gateway) {
		const status = String(gateway.gatewayStatus || '').toLowerCase()

		return {
			_id: gateway._id,
			id: gateway._id,

			serialNumber: gateway.serialNumber,
			gatewayType: gateway.gatewayType,
			isAssigned: gateway.isAssigned,

			companyId: gateway.companyId?._id || gateway.companyId || null,
			companyName: gateway.companyId?.companyName || null,

			buildingId: gateway.buildingId?._id || gateway.buildingId || null,
			buildingName: gateway.buildingId?.title || null,
			buildingNumber: gateway.buildingId?.number || null,
			buildingAddress: gateway.buildingId?.address || null,

			installedLocation: gateway.installedLocation || null,
			gatewayStatus: gateway.gatewayStatus,
			isOnline: status === 'online',

			lastSeenAt: gateway.lastSeenAt || null,
			createdAt: gateway.createdAt,
			updatedAt: gateway.updatedAt,
		}
	}

	normalizeNode(node) {
		return {
			_id: node._id,
			number: node.number,
			nodeType: node.nodeType,
			companyName: node.companyId?.companyName || null,
			gatewaySerialNumber: node.gatewayId?.serialNumber || null,
			gatewayId: node.gatewayId?._id || null, // ?. qo'shildi

			status: node.status,
			installedLocation: node.installedLocation || '',
		}
	}

	normalizeNumbers(numbers) {
		if (!Array.isArray(numbers)) {
			throw createError(400, 'numbers must be an array')
		}

		const parsed = numbers
			.map(num => Number(num))
			.filter(num => Number.isInteger(num) && num > 0)

		const unique = [...new Set(parsed)]

		if (unique.length === 0) {
			throw createError(400, 'Valid node numbers are required')
		}

		return unique
	}

	// ========= Admin Device page services ==========

	async getGateways({ search = '' } = {}) {
		const query = {}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			query.$or = [
				{ serialNumber: regex },
				{ gatewayType: regex },
				{ gatewayStatus: regex },
				{ installedLocation: regex },
			]
		}

		const gateways = await this.gatewaySchema
			.find(query)
			.populate(
				'companyId',
				'companyName companyCode companyAddress companyTel companyEmail companyLogo',
			)
			.populate(
				'buildingId',
				'title number address buildingType buildingStatus',
			)
			.sort({ createdAt: -1 })
			.lean()

		return gateways.map(this.normalizeGateway)
	}

	async getNodes({ search = '', nodeType = '' } = {}) {
		const query = {}

		if (nodeType && nodeType !== '전체') {
			query.nodeType = nodeType
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')
			const numberSearch = Number(search)

			query.$or = [
				{ nodeType: regex },
				{ status: regex },
				{ installedLocation: regex },
			]

			if (Number.isInteger(numberSearch)) {
				query.$or.push({ number: numberSearch })
			}
		}

		const nodes = await this.nodeSchema
			.find(query)
			.populate('companyId', 'companyName companyCode')
			.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	/**
	 * Node register tab o‘ng tomondagi table uchun.
	 * Faqat:
	 * - gatewayId: null
	 *
	 * Eslatma:
	 * MongoDB da { gatewayId: null } null va field yo‘q holatlarini ham ushlaydi.
	 */
	async getAvailableNodes({ search = '', nodeType = '' } = {}) {
		const query = {
			isAssigned: false,
			gatewayId: null,
		}

		if (nodeType && nodeType !== '전체') {
			query.nodeType = nodeType
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')
			const numberSearch = Number(search)

			query.$or = [
				{ nodeType: regex },
				{ status: regex },
				{ installedLocation: regex },
			]

			if (Number.isInteger(numberSearch)) {
				query.$or.push({ number: numberSearch })
			}
		}

		const nodes = await this.nodeSchema
			.find(query)
			.populate('companyId', 'companyName companyCode')
			.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	async checkGatewayBySerialNumber(serialNumber) {
		if (!serialNumber || !String(serialNumber).trim()) {
			throw createError(400, 'Gateway serialNumber is required')
		}

		const gateway = await this.gatewaySchema
			.findOne({
				serialNumber: String(serialNumber).trim(),
			})
			.populate(
				'companyId',
				'companyName companyCode companyAddress companyTel companyEmail companyLogo',
			)
			.populate(
				'buildingId',
				'title number address buildingType buildingStatus',
			)
			.lean()

		if (!gateway) {
			throw createError(404, 'Gateway not found')
		}

		return this.normalizeGateway(gateway)
	}

	async checkAvailableNodes({ nodeType, numbers }) {
		if (!nodeType) {
			throw createError(400, 'nodeType is required')
		}

		const uniqueNumbers = this.normalizeNumbers(numbers)

		const nodes = await this.nodeSchema
			.find({
				nodeType,
				number: { $in: uniqueNumbers },
				isAssigned: false,
				gatewayId: null,
			})
			.sort({ number: 1 })
			.lean()

		const foundNumberSet = new Set(nodes.map(node => node.number))
		const missingNumbers = uniqueNumbers.filter(num => !foundNumberSet.has(num))

		return {
			ok: missingNumbers.length === 0,
			requestedCount: uniqueNumbers.length,
			foundCount: nodes.length,
			missingNumbers,
			nodes: nodes.map(this.normalizeNode),
		}
	}

	async registerNodesToGateway({
		gatewayId,
		gatewaySerialNumber,
		nodeType,
		numbers,
	}) {
		if (!nodeType) {
			throw createError(400, 'nodeType is required')
		}

		const uniqueNumbers = this.normalizeNumbers(numbers)

		const session = await mongoose.startSession()

		try {
			let result

			await session.withTransaction(async () => {
				const gatewayQuery = gatewayId
					? { _id: gatewayId }
					: { serialNumber: String(gatewaySerialNumber || '').trim() }

				if (!gatewayQuery._id && !gatewayQuery.serialNumber) {
					throw createError(400, 'gatewayId or gatewaySerialNumber is required')
				}

				const gateway = await this.gatewaySchema
					.findOne(gatewayQuery)
					.session(session)

				if (!gateway) {
					throw createError(404, 'Gateway not found')
				}

				const nodes = await this.nodeSchema
					.find({
						nodeType,
						number: { $in: uniqueNumbers },
						isAssigned: false,
						gatewayId: null,
					})
					.session(session)

				const foundNumberSet = new Set(nodes.map(node => node.number))
				const missingNumbers = uniqueNumbers.filter(
					num => !foundNumberSet.has(num),
				)

				if (missingNumbers.length > 0) {
					throw createError(
						409,
						'Some nodes are not available, already assigned, or nodeType does not match',
						{ missingNumbers },
					)
				}

				const nodeIds = nodes.map(node => node._id)

				const updateResult = await this.nodeSchema.updateMany(
					{
						_id: { $in: nodeIds },
						isAssigned: false,
						gatewayId: null,
					},
					{
						$set: {
							gatewayId: gateway._id,
							companyId: gateway.companyId || null,
							isAssigned: true,
						},
					},
					{ session },
				)

				if (updateResult.modifiedCount !== uniqueNumbers.length) {
					throw createError(
						409,
						'Nodes were changed by another request. Please refresh and try again.',
					)
				}

				const updatedNodes = await this.nodeSchema
					.find({
						_id: { $in: nodeIds },
					})
					.populate('companyId', 'companyName companyCode')
					.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
					.session(session)
					.lean()

				result = {
					ok: true,
					message: `${updatedNodes.length} nodes registered to gateway`,
					gatewayId: gateway._id,
					gatewaySerialNumber: gateway.serialNumber,
					nodes: updatedNodes.map(this.normalizeNode),
				}
			})

			return result
		} finally {
			await session.endSession()
		}
	}

	async getAssignedNodesByGateway({ gatewayId }) {
		if (!mongoose.Types.ObjectId.isValid(gatewayId)) {
			throw this.createError('Invalid gatewayId', 400)
		}

		const gateway = await this.gatewaySchema.findById(gatewayId).lean()

		if (!gateway) {
			throw this.createError('Gateway not found', 404)
		}

		const nodes = await this.nodeSchema
			.find({
				gatewayId,
			})
			.populate('companyId', 'companyName')
			.populate('gatewayId', 'serialNumber')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	// ========================= Company device management page services ===================

	resolveNodeConfig(nodeType) {
		const input = String(nodeType || '').trim()

		// "gangform_node" => "GANGFORM",  "GANGFORM" => "GANGFORM"
		const reverseMap = {
			[NODE_TYPE.DOOR]: 'DOOR', // 'door_node' => 'DOOR'
			[NODE_TYPE.ANGLE]: 'ANGLE', // 'angle_node' => 'ANGLE'
			[NODE_TYPE.GANGFORM]: 'GANGFORM', // 'gangform_node' => 'GANGFORM'
		}

		const key = reverseMap[input] || input.toUpperCase()

		const configMap = {
			DOOR: {
				dbNodeType: NODE_TYPE.DOOR,
				publishNodeType: 0,
			},
			ANGLE: {
				dbNodeType: NODE_TYPE.ANGLE,
				publishNodeType: 1,
			},
			GANGFORM: {
				dbNodeType: NODE_TYPE.GANGFORM,
				publishNodeType: 2,
			},
		}

		const config = configMap[key]

		if (!config) {
			throw this.createError(
				'Invalid nodeType. Allowed values: DOOR, ANGLE, GANGFORM, door_node, angle_node, gangform_node',
				400,
			)
		}

		return {
			requestNodeType: key,
			dbNodeType: config.dbNodeType,
			publishNodeType: config.publishNodeType,
			model: this.nodeSchema,
		}
	}

	buildGatewayTopic(serialNumber) {
		return `GSSIOT/01030369081/GATE_SUB/GRM22JU22P${serialNumber}`
	}

	async publishAsync(topic, payload) {
		logger('Publishing to MQTT:', { topic, payload })

		const mqttClient = getMqttClient()

		if (!mqttClient || !mqttClient.connected) {
			throw this.createError(
				'MQTT client is not connected (initMqtt called?)',
				500,
			)
		}

		return new Promise((resolve, reject) => {
			mqttClient.publish(topic, JSON.stringify(payload), err => {
				if (err) reject(err)
				else resolve(true)
			})
		})
	}

	waitForGatewayResponse({ gw_number, timeoutMs = 10000 }) {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				cleanup()
				reject(this.createError('MQTT response timeout', 504))
			}, timeoutMs)

			const handler = payload => {
				logger('Received MQTT response:', payload)

				if (String(payload?.gw_number) !== String(gw_number)) return

				cleanup()

				if (payload?.data?.resp === 'success') {
					resolve(true)
				} else {
					reject(this.createError('Failed publishing for gateway to mqtt', 400))
				}
			}

			const cleanup = () => {
				clearTimeout(timer)
				eventBus.removeListener('gateway.response', handler)
			}

			eventBus.on('gateway.response', handler)
		})
	}

	toObjectId(id, fieldName = 'id') {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw createError(400, `Invalid ${fieldName}`)
		}

		return new mongoose.Types.ObjectId(id)
	}

	async getCompanyGateways({ companyId, search = '' } = {}) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')

		const query = {
			companyId: companyObjectId,
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			query.$or = [
				{ serialNumber: regex },
				{ gatewayType: regex },
				{ gatewayStatus: regex },
				{ installedLocation: regex },
			]
		}

		const gateways = await this.gatewaySchema
			.find(query)
			.populate(
				'companyId',
				'companyName companyCode companyAddress companyTel companyEmail companyLogo',
			)
			.populate(
				'buildingId',
				'title number address buildingType buildingStatus',
			)
			.sort({ createdAt: -1 })
			.lean()

		return gateways.map(this.normalizeGateway)
	}

	async getCompanyNodes({ companyId, search = '', nodeType = '' } = {}) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')

		const query = {
			companyId: companyObjectId,
		}

		if (nodeType && nodeType !== '전체') {
			query.nodeType = nodeType
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')
			const numberSearch = Number(search)

			query.$or = [
				{ nodeType: regex },
				{ status: regex },
				{ installedLocation: regex },
			]

			if (Number.isInteger(numberSearch)) {
				query.$or.push({ number: numberSearch })
			}
		}

		const nodes = await this.nodeSchema
			.find(query)
			.populate('companyId', 'companyName')
			.populate('gatewayId', 'serialNumber')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	async getCompanyAvailableNodes({
		companyId,
		search = '',
		nodeType = '',
	} = {}) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')

		const query = {
			companyId: companyObjectId,
			gatewayId: null,
		}

		if (nodeType && nodeType !== '전체') {
			query.nodeType = nodeType
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')
			const numberSearch = Number(search)

			query.$or = [
				{ nodeType: regex },
				{ status: regex },
				{ installedLocation: regex },
			]

			if (Number.isInteger(numberSearch)) {
				query.$or.push({ number: numberSearch })
			}
		}

		const nodes = await this.nodeSchema
			.find(query)
			.populate('companyId', 'companyName companyCode')
			.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	async checkCompanyAvailableNodes({ companyId, nodeType, numbers }) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')

		if (!nodeType) {
			throw createError(400, 'nodeType is required')
		}

		const uniqueNumbers = this.normalizeNumbers(numbers)

		const nodes = await this.nodeSchema
			.find({
				companyId: companyObjectId,
				nodeType,
				number: { $in: uniqueNumbers },
				gatewayId: null,
			})
			.sort({ number: 1 })
			.lean()

		const foundNumberSet = new Set(nodes.map(node => node.number))
		const missingNumbers = uniqueNumbers.filter(num => !foundNumberSet.has(num))

		return {
			ok: missingNumbers.length === 0,
			requestedCount: uniqueNumbers.length,
			foundCount: nodes.length,
			missingNumbers,
			nodes: nodes.map(this.normalizeNode),
		}
	}

	// async registerCompanyNodesToGateway({
	// 	companyId,
	// 	gatewayId,
	// 	gatewaySerialNumber,
	// 	nodeType,
	// 	numbers,
	// }) {
	// 	const companyObjectId = this.toObjectId(companyId, 'companyId')

	// 	if (!nodeType) {
	// 		throw this.createError('nodeType is required', 400)
	// 	}

	// 	const uniqueNumbers = this.normalizeNumbers(numbers)
	// 	const session = await mongoose.startSession()

	// 	try {
	// 		let result

	// 		await session.withTransaction(async () => {
	// 			const gatewayQuery = gatewayId
	// 				? {
	// 						_id: this.toObjectId(gatewayId, 'gatewayId'),
	// 						companyId: companyObjectId,
	// 					}
	// 				: {
	// 						serialNumber: String(gatewaySerialNumber || '').trim(),
	// 						companyId: companyObjectId,
	// 					}

	// 			if (!gatewayQuery._id && !gatewayQuery.serialNumber) {
	// 				throw this.createError(
	// 					400,
	// 					'gatewayId or gatewaySerialNumber is required',
	// 				)
	// 			}

	// 			const gateway = await this.gatewaySchema
	// 				.findOne(gatewayQuery)
	// 				.session(session)

	// 			if (!gateway) {
	// 				throw this.createError('Gateway not found for this company', 404)
	// 			}

	// 			const nodes = await this.nodeSchema
	// 				.find({
	// 					companyId: companyObjectId,
	// 					nodeType,
	// 					number: { $in: uniqueNumbers },
	// 					gatewayId: null,
	// 				})
	// 				.session(session)

	// 			const foundNumberSet = new Set(nodes.map(node => node.number))
	// 			const missingNumbers = uniqueNumbers.filter(
	// 				num => !foundNumberSet.has(num),
	// 			)

	// 			if (missingNumbers.length > 0) {
	// 				throw this.createError(
	// 					'Some nodes are not available for this company, already assigned, or nodeType does not match',
	// 					409,
	// 				)
	// 			}

	// 			const nodeIds = nodes.map(node => node._id)

	// 			const updateResult = await this.nodeSchema.updateMany(
	// 				{
	// 					_id: { $in: nodeIds },
	// 					companyId: companyObjectId,
	// 					gatewayId: null,
	// 				},
	// 				{
	// 					$set: {
	// 						gatewayId: gateway._id,
	// 						companyId: companyObjectId,
	// 					},
	// 				},
	// 				{ session },
	// 			)

	// 			if (updateResult.modifiedCount !== uniqueNumbers.length) {
	// 				throw this.createError(
	// 					'Nodes were changed by another request. Please refresh and try again.',
	// 					409,
	// 				)
	// 			}

	// 			const updatedNodes = await this.nodeSchema
	// 				.find({
	// 					_id: { $in: nodeIds },
	// 					companyId: companyObjectId,
	// 				})
	// 				.populate('companyId', 'companyName companyCode')
	// 				.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
	// 				.session(session)
	// 				.lean()

	// 			result = {
	// 				ok: true,
	// 				message: `${updatedNodes.length} nodes registered to gateway`,
	// 				companyId,
	// 				gatewayId: gateway._id,
	// 				gatewaySerialNumber: gateway.serialNumber,
	// 				nodes: updatedNodes.map(this.normalizeNode),
	// 			}
	// 		})

	// 		return result
	// 	} finally {
	// 		await session.endSession()
	// 	}
	// }

	async registerCompanyNodesToGatewayMqtt({
		companyId,
		gatewayId,
		gatewaySerialNumber,
		nodeType,
		numbers,
	}) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')

		if (!nodeType) throw this.createError('nodeType is required', 400)

		const uniqueNumbers = this.normalizeNumbers(numbers)

		// --- 1. BOSQICH: Validate (transaction) ---
		const { gateway, nodes } = await this._validateAndFetchForRegistration({
			companyObjectId,
			gatewayId,
			gatewaySerialNumber,
			nodeType,
			uniqueNumbers,
		})

		// --- 2. BOSQICH: MQTT ---
		const config = this.resolveNodeConfig(nodeType)
		const topic = this.buildGatewayTopic(gateway.serialNumber)

		const publishData = {
			cmd: 2,
			nodeType: config.publishNodeType,
			numNodes: nodes.length,
			nodes: nodes.map(n => n.number),
		}

		const waitPromise = this.waitForGatewayResponse({
			gw_number: gateway.serialNumber,
			timeoutMs: 10000,
		})

		await this.publishAsync(topic, publishData)
		await waitPromise

		// --- 3. BOSQICH: DB update ---
		const nodeIds = nodes.map(n => n._id)

		const updateResult = await this.nodeSchema.updateMany(
			{ _id: { $in: nodeIds }, companyId: companyObjectId, gatewayId: null },
			{ $set: { gatewayId: gateway._id, companyId: companyObjectId } },
		)

		if (updateResult.modifiedCount !== uniqueNumbers.length) {
			throw this.createError(
				'Nodes were changed by another request. Please refresh and try again.',
				409,
			)
		}

		const updatedNodes = await this.nodeSchema
			.find({ _id: { $in: nodeIds } })
			.populate('companyId', 'companyName companyCode')
			.populate('gatewayId', 'serialNumber gatewayType gatewayStatus')
			.lean()

		return {
			ok: true,
			message: `${updatedNodes.length} nodes registered to gateway`,
			companyId,
			gatewayId: gateway._id,
			gatewaySerialNumber: gateway.serialNumber,
			nodes: updatedNodes.map(this.normalizeNode),
		}
	}

	// Yordamchi: faqat validation va fetch
	async _validateAndFetchForRegistration({
		companyObjectId,
		gatewayId,
		gatewaySerialNumber,
		nodeType,
		uniqueNumbers,
	}) {
		const session = await mongoose.startSession()
		try {
			let gateway, nodes

			await session.withTransaction(async () => {
				const gatewayQuery = gatewayId
					? {
							_id: this.toObjectId(gatewayId, 'gatewayId'),
							companyId: companyObjectId,
						}
					: {
							serialNumber: String(gatewaySerialNumber || '').trim(),
							companyId: companyObjectId,
						}

				gateway = await this.gatewaySchema
					.findOne(gatewayQuery)
					.session(session)
				if (!gateway)
					throw this.createError('Gateway not found for this company', 404)

				nodes = await this.nodeSchema
					.find({
						companyId: companyObjectId,
						nodeType,
						number: { $in: uniqueNumbers },
						gatewayId: null,
					})
					.session(session)

				const foundSet = new Set(nodes.map(n => n.number))
				const missing = uniqueNumbers.filter(num => !foundSet.has(num))

				if (missing.length > 0) {
					throw this.createError(
						'Some nodes are not available for this company, already assigned, or nodeType does not match',
						409,
					)
				}
			})

			return { gateway, nodes }
		} finally {
			await session.endSession()
		}
	}

	async unassignCompanyNodes({ companyId, nodeIds }) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')
		if (!nodeIds?.length) throw this.createError('nodeIds is required', 400)

		const objectIds = nodeIds.map(id => this.toObjectId(id, 'nodeId'))
		const session = await mongoose.startSession()

		try {
			let result
			await session.withTransaction(async () => {
				const updateResult = await this.nodeSchema.updateMany(
					{
						_id: { $in: objectIds },
						companyId: companyObjectId,
						gatewayId: { $ne: null },
					},
					{ $set: { gatewayId: null } },
					{ session },
				)
				result = { ok: true, modifiedCount: updateResult.modifiedCount }
			})
			return result
		} finally {
			await session.endSession()
		}
	}

	async getCompanyAssignedNodesByGateway({ companyId, gatewayId }) {
		const companyObjectId = this.toObjectId(companyId, 'companyId')
		const gatewayObjectId = this.toObjectId(gatewayId, 'gatewayId')

		const gateway = await this.gatewaySchema
			.findOne({
				_id: gatewayObjectId,
				companyId: companyObjectId,
			})
			.lean()

		if (!gateway) {
			throw createError(404, 'Gateway not found for this company')
		}

		const nodes = await this.nodeSchema
			.find({
				companyId: companyObjectId,
				gatewayId: gatewayObjectId,
			})
			.populate('companyId', 'companyName')
			.populate('gatewayId', 'serialNumber')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}

	// ========= Admin All Devices page services ==========

	async getAdminAllGateways({ search = '' } = {}) {
		const query = {}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			query.$or = [
				{ serialNumber: regex },
				{ gatewayType: regex },
				{ gatewayStatus: regex },
				{ installedLocation: regex },
			]
		}

		const gateways = await this.gatewaySchema
			.find(query)
			.populate('companyId', 'companyName')
			.populate(
				'buildingId',
				'title number address buildingType buildingStatus',
			)
			.sort({ createdAt: -1 })
			.lean()

		return gateways.map(this.normalizeGateway)
	}

	async getAdminAllNodes({ search = '', nodeType = '' } = {}) {
		const query = {}

		if (nodeType && nodeType !== '전체') {
			query.nodeType = nodeType
		}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')
			const numberSearch = Number(search)

			query.$or = [
				{ nodeType: regex },
				{ status: regex },
				{ installedLocation: regex },
			]

			if (Number.isInteger(numberSearch)) {
				query.$or.push({ number: numberSearch })
			}
		}

		const nodes = await this.nodeSchema
			.find(query)
			.populate('companyId', 'companyName')
			.populate('gatewayId', 'serialNumber')
			.sort({ number: 1 })
			.lean()

		return nodes.map(this.normalizeNode)
	}
}

module.exports = AdminDashboardService
