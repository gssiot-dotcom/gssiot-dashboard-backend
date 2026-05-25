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
} = require('../../lib/config')
const { buildPaginationMeta } = require('../../utils/pagination')
const { default: mongoose } = require('mongoose')
const { UserSchema } = require('../users/user.model')
const bcrypt = require('bcryptjs')

class AdminOrganizationService {
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

	validateObjectId(id, message = 'Invalid id') {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError(message, 400)
		}
	}

	escapeRegex(text) {
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
	}

	// ============ Admin Organization methods ============= //
	groupCountById(items) {
		return items.reduce((acc, item) => {
			acc[item._id.toString()] = item.count
			return acc
		}, {})
	}

	normalizeCompany(company, extra = {}) {
		return {
			_id: company._id,
			companyName: company.companyName,
			companyCode: company.companyCode || null,
			companyAddress: company.companyAddress,
			companyTel: company.companyTel || null,
			companyEmail: company.companyEmail || null,
			companyLogo: company.companyLogo || null,
			companyStatus: company.companyStatus,

			buildingCount: extra.buildingCount || 0,

			createdAt: company.createdAt,
			updatedAt: company.updatedAt,
		}
	}

	normalizeBuilding(building, extra = {}) {
		const company =
			building.companyId && typeof building.companyId === 'object'
				? building.companyId
				: null

		return {
			_id: building._id,

			title: building.title,
			number: building.number || null,
			address: building.address,
			buildingType: building.buildingType,
			buildingPlanImage: building.buildingPlanImage || [],
			buildingRealImage: building.buildingRealImage || [],
			buildingStatus: building.buildingStatus,
			startDate: building.startDate || null,
			isAssigned: building.isAssigned,

			companyId: company?._id || building.companyId,
			companyName: company?.companyName || extra.companyName || null,

			gatewayCount: extra.gatewayCount || 0,

			createdAt: building.createdAt,
			updatedAt: building.updatedAt,
		}
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

	normalizeUser(user, extra = {}) {
		return {
			_id: user._id,

			name: user.name,
			email: user.email,
			phone: user.phone || '',
			userType: user.userType,
			userStatus: user.userStatus,

			isAssigned: !!extra.companyId,
			companyId: extra.companyId || null,
			companyName: extra.companyName || null,
		}
	}

	async getCompanies({ page = 1, limit = 20, skip = 0, search = '' }) {
		const companyFilter = {}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			companyFilter.$or = [
				{ companyName: regex },
				{ companyCode: regex },
				{ companyAddress: regex },
				{ companyTel: regex },
				{ companyEmail: regex },
				{ companyStatus: regex },
			]
		}

		const [companies, total] = await Promise.all([
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
				items: [],
				pagination: this.createPaginationMeta({ total, page, limit }),
			}
		}

		const buildingCountsAgg = await this.buildingSchema.aggregate([
			{
				$match: {
					companyId: { $in: companyIds },
				},
			},
			{
				$group: {
					_id: '$companyId',
					count: { $sum: 1 },
				},
			},
		])

		const buildingCountByCompanyId = this.groupCountById(buildingCountsAgg)

		return {
			items: companies.map(company => {
				const companyId = company._id.toString()

				return this.normalizeCompany(company, {
					buildingCount: buildingCountByCompanyId[companyId] || 0,
				})
			}),

			pagination: this.createPaginationMeta({ total, page, limit }),
		}
	}

	async getBuildings({ page = 1, limit = 20, skip = 0, search = '' }) {
		const buildingFilter = {}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			const matchedCompanyIds = await this.companySchema.distinct('_id', {
				$or: [
					{ companyName: regex },
					{ companyCode: regex },
					{ companyAddress: regex },
					{ companyTel: regex },
					{ companyEmail: regex },
				],
			})

			buildingFilter.$or = [
				{ title: regex },
				{ address: regex },
				{ buildingType: regex },
				{ buildingStatus: regex },
			]

			if (matchedCompanyIds.length > 0) {
				buildingFilter.$or.push({
					companyId: { $in: matchedCompanyIds },
				})
			}
		}

		const [buildings, total] = await Promise.all([
			this.buildingSchema
				.find(buildingFilter)
				.populate({
					path: 'companyId',
					select: '_id companyName',
				})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.buildingSchema.countDocuments(buildingFilter),
		])

		const buildingIds = buildings.map(building => building._id)

		if (!buildingIds.length) {
			return {
				items: [],
				pagination: this.createPaginationMeta({ total, page, limit }),
			}
		}

		const gatewayCountsAgg = await this.gatewaySchema.aggregate([
			{
				$match: {
					buildingId: { $in: buildingIds },
					isAssigned: true,
				},
			},
			{
				$group: {
					_id: '$buildingId',
					count: { $sum: 1 },
				},
			},
		])

		const gatewayCountByBuildingId = this.groupCountById(gatewayCountsAgg)

		return {
			items: buildings.map(building => {
				const buildingId = building._id.toString()

				return this.normalizeBuilding(building, {
					gatewayCount: gatewayCountByBuildingId[buildingId] || 0,
				})
			}),

			pagination: this.createPaginationMeta({ total, page, limit }),
		}
	}

	async getUsers({ page = 1, limit = 20, skip = 0, search = '' }) {
		const userFilter = {}

		if (search) {
			const regex = new RegExp(this.escapeRegex(search), 'i')

			const matchedCompanyIds = await this.companySchema.distinct('_id', {
				$or: [
					{ companyName: regex },
					{ companyCode: regex },
					{ companyAddress: regex },
					{ companyTel: regex },
					{ companyEmail: regex },
				],
			})

			const matchedMemberUserIds =
				matchedCompanyIds.length > 0
					? await this.companyMemberSchema.distinct('memberId', {
							companyId: { $in: matchedCompanyIds },
						})
					: []

			userFilter.$or = [
				{ name: regex },
				{ email: regex },
				{ phone: regex },
				{ userType: regex },
				{ userStatus: regex },
			]

			if (matchedMemberUserIds.length > 0) {
				userFilter.$or.push({
					_id: { $in: matchedMemberUserIds },
				})
			}
		}

		const [users, total] = await Promise.all([
			this.userSchema
				.find(userFilter)
				.select('_id name email phone userType userStatus')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean(),

			this.userSchema.countDocuments(userFilter),
		])

		const userIds = users.map(user => user._id)

		if (!userIds.length) {
			return {
				items: [],
				pagination: this.createPaginationMeta({ total, page, limit }),
			}
		}

		const activeStatus = MEMBER_STATUS?.ACTIVE || 'active'

		const companyMembers = await this.companyMemberSchema
			.find({
				memberId: { $in: userIds },
				status: activeStatus,
			})
			.populate({
				path: 'companyId',
				select:
					'_id companyName companyStatus companyAddress companyTel companyEmail',
			})
			.sort({ createdAt: -1 })
			.lean()

		const companyMemberByUserId = companyMembers.reduce((acc, member) => {
			const userId = member.memberId?.toString()

			if (!userId || acc[userId]) {
				return acc
			}

			acc[userId] = member

			return acc
		}, {})

		return {
			items: users.map(user => {
				const member = companyMemberByUserId[user._id.toString()]
				const company = member?.companyId

				return this.normalizeUser(user, {
					companyId: company?._id || null,
					companyName: company?.companyName || null,
				})
			}),

			pagination: this.createPaginationMeta({ total, page, limit }),
		}
	}

	async getCompanyBuildings(companyId) {
		this.validateObjectId(companyId, 'Invalid company id')

		const company = await this.companySchema.findById(companyId).lean()

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const buildings = await this.buildingSchema
			.find({
				companyId,
			})
			.populate({
				path: 'companyId',
				select: '_id companyName',
			})
			.sort({ createdAt: -1 })
			.lean()

		const buildingIds = buildings.map(building => building._id)

		const gatewayCountsAgg = buildingIds.length
			? await this.gatewaySchema.aggregate([
					{
						$match: {
							buildingId: { $in: buildingIds },
							isAssigned: true,
						},
					},
					{
						$group: {
							_id: '$buildingId',
							count: { $sum: 1 },
						},
					},
				])
			: []

		const gatewayCountByBuildingId = this.groupCountById(gatewayCountsAgg)

		return buildings.map(building => {
			const buildingId = building._id.toString()

			return this.normalizeBuilding(building, {
				gatewayCount: gatewayCountByBuildingId[buildingId] || 0,
				companyName: company.companyName,
			})
		})
	}

	async getBuildingGateways(buildingId) {
		this.validateObjectId(buildingId, 'Invalid building id')

		const building = await this.buildingSchema.findById(buildingId).lean()

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		const gateways = await this.gatewaySchema
			.find({
				buildingId,
				isAssigned: true,
			})
			.populate({
				path: 'buildingId',
				select: '_id title address',
			})
			.sort({ createdAt: -1 })
			.lean()

		return gateways.map(gateway =>
			this.normalizeGateway(gateway, {
				buildingName: building.title,
			}),
		)
	}

	async getUserCompanies(userId) {
		this.validateObjectId(userId, 'Invalid user id')

		const user = await this.userSchema.findById(userId).lean()

		if (!user) {
			throw this.createError('User not found', 404)
		}

		const activeStatus = MEMBER_STATUS?.ACTIVE || 'active'

		const companyMembers = await this.companyMemberSchema
			.find({
				memberId: userId,
				status: activeStatus,
			})
			.populate({
				path: 'companyId',
				select:
					'_id companyName companyCode companyAddress companyTel companyEmail companyLogo companyStatus createdAt updatedAt',
			})
			.sort({ createdAt: -1 })
			.lean()

		return companyMembers
			.filter(member => member.companyId)
			.map(member => this.normalizeCompany(member.companyId))
	}
}

module.exports = AdminOrganizationService
