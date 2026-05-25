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

class AdminCompanyAssignmentsService {
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

	toObjectIds(ids = []) {
		return ids
			.filter(id => mongoose.Types.ObjectId.isValid(id))
			.map(id => new mongoose.Types.ObjectId(id))
	}

	async getCompanyAssignments({ search = '' }) {
		const companyFilter = {}

		if (search) {
			companyFilter.$or = [
				{ companyName: { $regex: search, $options: 'i' } },
				{ companyAddress: { $regex: search, $options: 'i' } },
				{ companyCode: { $regex: search, $options: 'i' } },
			]
		}

		const [companies, gateways, nodes] = await Promise.all([
			this.companySchema
				.find(companyFilter)
				.select('_id companyName companyAddress companyStatus')
				.sort({ createdAt: -1 })
				.lean(),

			this.gatewaySchema
				.find({})
				.select(
					'_id serialNumber gatewayType gatewayStatus installedLocation companyId isAssigned',
				)
				.sort({ createdAt: -1 })
				.lean(),

			this.nodeSchema
				.find({})
				.select(
					'_id number nodeType status installedLocation companyId gatewayId isAssigned',
				)
				.sort({ number: 1 })
				.lean(),
		])

		return {
			companies,
			gateways,
			nodes,
		}
	}

	async updateCompanyGateways({ companyId, gatewayIds = [] }) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			const error = new Error('Invalid company id')
			error.status = 400
			throw error
		}

		const companyObjectId = new mongoose.Types.ObjectId(companyId)
		const gatewayObjectIds = this.toObjectIds(gatewayIds)

		const company = await this.companySchema
			.findById(companyObjectId)
			.select('_id')
			.lean()

		if (!company) {
			const error = new Error('Company not found')
			error.status = 404
			throw error
		}

		const invalidAssignedGateway = await this.gatewaySchema.findOne({
			_id: { $in: gatewayObjectIds },
			$and: [
				{ companyId: { $ne: null } },
				{ companyId: { $ne: companyObjectId } },
			],
		})

		if (invalidAssignedGateway) {
			const error = new Error(
				'Some gateways are already assigned to another company',
			)
			error.status = 400
			throw error
		}

		await this.gatewaySchema.updateMany(
			{
				companyId: companyObjectId,
				_id: { $nin: gatewayObjectIds },
			},
			{
				$set: {
					companyId: null,
					buildingId: null,
					isAssigned: false,
				},
			},
		)

		if (gatewayObjectIds.length > 0) {
			await this.gatewaySchema.updateMany(
				{
					_id: { $in: gatewayObjectIds },
				},
				{
					$set: {
						companyId: companyObjectId,
						isAssigned: true,
					},
				},
			)
		}

		return {
			companyId,
			gatewayIds,
		}
	}

	async updateCompanyNodes({ companyId, nodeIds = [] }) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			const error = new Error('Invalid company id')
			error.status = 400
			throw error
		}

		const companyObjectId = new mongoose.Types.ObjectId(companyId)
		const nodeObjectIds = this.toObjectIds(nodeIds)

		const company = await this.companySchema
			.findById(companyObjectId)
			.select('_id')
			.lean()

		if (!company) {
			const error = new Error('Company not found')
			error.status = 404
			throw error
		}

		const invalidAssignedNode = await this.nodeSchema.findOne({
			_id: { $in: nodeObjectIds },
			$and: [
				{ companyId: { $ne: null } },
				{ companyId: { $ne: companyObjectId } },
			],
		})

		if (invalidAssignedNode) {
			const error = new Error(
				'Some nodes are already assigned to another company',
			)
			error.status = 400
			throw error
		}

		await this.nodeSchema.updateMany(
			{
				companyId: companyObjectId,
				_id: { $nin: nodeObjectIds },
			},
			{
				$set: {
					companyId: null,
					gatewayId: null,
					isAssigned: false,
				},
			},
		)

		if (nodeObjectIds.length > 0) {
			await this.nodeSchema.updateMany(
				{
					_id: { $in: nodeObjectIds },
				},
				{
					$set: {
						companyId: companyObjectId,
						isAssigned: true,
					},
				},
			)
		}

		return {
			companyId,
			nodeIds,
		}
	}
}

module.exports = AdminCompanyAssignmentsService
