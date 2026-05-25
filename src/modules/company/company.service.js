const mongoose = require('mongoose')
const { COMPANY_MEMBER_TYPES } = require('../../lib/config')
const { CompanyMemberSchema, CompanySchema } = require('./company.model')
const { UserSchema } = require('../users/user.model')
const {
	BuildingSchema,
	BuildingWorkerSchema,
} = require('../building/building.model')

class CompanyService {
	constructor() {
		this.companySchema = CompanySchema
		this.companyMemberSchema = CompanyMemberSchema
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.userSchema = UserSchema
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	normalizeEmail(email) {
		if (!email) return ''
		return String(email).trim().toLowerCase()
	}

	async createCompany(payload = {}) {
		const session = await mongoose.startSession()
		session.startTransaction()

		try {
			const companyName = payload.companyName?.trim()
			const companyAddress = payload.companyAddress?.trim()
			const companyTel = payload.companyTel?.trim() || null

			if (!companyName) {
				throw this.createError('companyName is required', 400)
			}

			if (!companyAddress) {
				throw this.createError('companyAddress is required', 400)
			}

			const createdCompany = await this.companySchema.create({
				companyName,
				companyAddress,
				companyTel,
			})

			if (!createdCompany) {
				throw this.createError('Failed to create company', 500)
			}

			return {
				company: createdCompany,
			}
		} catch (error) {
			if (error.statusCode) throw error

			throw this.createError(error.message || 'Error on creating company', 400)
		}
	}

	async getCompanies(query = {}) {
		const filter = {}

		if (query.status !== undefined) {
			filter.status = String(query.status) === 'true'
		}

		if (query.created_by) {
			if (!mongoose.Types.ObjectId.isValid(query.created_by)) {
				throw this.createError('Invalid created_by id', 400)
			}

			filter.created_by = query.created_by
		}

		if (query.keyword) {
			filter.company_name = { $regex: query.keyword.trim(), $options: 'i' }
		}

		const companies = await this.companySchema
			.find(filter)
			.sort({ createdAt: -1 })

		return companies
	}

	async getActiveCompanies() {
		const companies = await this.companySchema
			.find({ status: true })
			.sort({ createdAt: -1 })

		return companies
	}

	async getCompanyDetail(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid company id', 400)
		}

		const company = await this.companySchema.findById(id)

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		return company
	}

	async getCompanyBuildings(companyId) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		const company = await this.companySchema.findById(companyId)
		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const buildings = await this.buildingSchema
			.find({ company_id: companyId })
			.sort({ createdAt: -1 })

		return {
			company_id: company._id,
			company_name: company.company_name,
			count: buildings.length,
			buildings,
		}
	}

	async updateCompanyStatus(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid company id', 400)
		}

		const company = await this.companySchema.findOneAndUpdate(
			{ _id: id },
			[{ $set: { status: { $not: '$status' } } }],
			{ new: true },
		)

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		return company
	}

	async updateCompany(id, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid company id', 400)
		}

		const allowedFields = [
			'company_name',
			'company_code',
			'biz_number',
			'company_addr',
			'company_tel',
			'company_email',
			'company_logo',
			'status',
			'created_by',
		]

		const updateData = {}

		for (const field of allowedFields) {
			if (payload[field] !== undefined) {
				updateData[field] = payload[field]
			}
		}

		if (updateData.company_name !== undefined) {
			updateData.company_name = String(updateData.company_name).trim()

			if (!updateData.company_name) {
				throw this.createError('company_name cannot be empty', 400)
			}
		}

		if (updateData.company_email !== undefined) {
			updateData.company_email = this.normalizeEmail(updateData.company_email)
		}

		if (updateData.created_by !== undefined && updateData.created_by !== null) {
			if (!mongoose.Types.ObjectId.isValid(updateData.created_by)) {
				throw this.createError('Invalid created_by id', 400)
			}
		}

		if (Object.keys(updateData).length === 0) {
			throw this.createError('No valid fields provided for update', 400)
		}

		const updatedCompany = await this.companySchema.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true },
		)

		if (!updatedCompany) {
			throw this.createError('Company not found', 404)
		}

		return updatedCompany
	}

	async getCompanyMembers(companyId) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		const company = await this.companySchema.findById(companyId)
		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const members = await this.companyMemberSchema
			.find({
				company_id: companyId,
				status: true,
			})
			.populate('user_id', 'name email phone user_type profile_img')
			.sort({ createdAt: -1 })

		return members
	}

	async assignManagers(companyId, payload = {}) {
		const { user_ids = [] } = payload

		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		if (!Array.isArray(user_ids) || user_ids.length === 0) {
			throw this.createError('user_ids must be a non-empty array', 400)
		}

		for (const userId of user_ids) {
			if (!mongoose.Types.ObjectId.isValid(userId)) {
				throw this.createError(`Invalid user id: ${userId}`, 400)
			}
		}

		const company = await this.companySchema.findById(companyId)

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const users = await this.userSchema.find({
			_id: { $in: user_ids },
			status: true,
		})

		if (users.length !== user_ids.length) {
			throw this.createError('Some users not found', 404)
		}

		const invalidUsers = users.filter(
			user => user.user_type !== COMPANY_MEMBER_TYPES.MANAGER,
		)

		if (invalidUsers.length > 0) {
			throw this.createError(
				'Only MANAGER type users can be assigned as company managers',
				400,
			)
		}

		const results = []

		for (const userId of user_ids) {
			const existingMember = await this.companyMemberSchema.findOne({
				company_id: companyId,
				user_id: userId,
			})

			if (
				existingMember &&
				existingMember.status &&
				existingMember.member_role === COMPANY_MEMBER_TYPES.MANAGER
			) {
				results.push({
					user_id: userId,
					status: 'already_exists',
					member: existingMember,
				})
				continue
			}

			if (
				existingMember &&
				existingMember.status &&
				existingMember.member_role !== COMPANY_MEMBER_TYPES.MANAGER
			) {
				throw this.createError(
					'This user is already assigned to this company with another role',
					409,
				)
			}

			if (existingMember && !existingMember.status) {
				existingMember.status = true
				existingMember.member_role = COMPANY_MEMBER_TYPES.MANAGER
				await existingMember.save()

				results.push({
					user_id: userId,
					status: 'reactivated',
					member: existingMember,
				})
				continue
			}

			const member = await this.companyMemberSchema.create({
				company_id: companyId,
				user_id: userId,
				member_role: COMPANY_MEMBER_TYPES.MANAGER,
			})

			results.push({
				user_id: userId,
				status: 'created',
				member,
			})
		}

		return results
	}

	async assignWorkersToBuilding(companyId, buildingId, payload = {}) {
		const { user_ids = [] } = payload

		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		if (!Array.isArray(user_ids) || user_ids.length === 0) {
			throw this.createError('user_ids must be a non-empty array', 400)
		}

		for (const userId of user_ids) {
			if (!mongoose.Types.ObjectId.isValid(userId)) {
				throw this.createError(`Invalid user id: ${userId}`, 400)
			}
		}

		const users = await this.userSchema.find({
			_id: { $in: user_ids },
			status: true,
		})

		if (users.length !== user_ids.length) {
			throw this.createError('Some users not found', 404)
		}

		const invalidUsers = users.filter(
			user => user.user_type !== COMPANY_MEMBER_TYPES.WORKER,
		)

		if (invalidUsers.length > 0) {
			throw this.createError(
				'Only WORKER type users can be assigned to building as company workers',
				400,
			)
		}

		const company = await this.companySchema.findById(companyId)

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const building = await this.buildingSchema.findOne({
			_id: buildingId,
			company_id: companyId,
			building_status: true,
		})

		if (!building) {
			throw this.createError('Building not found in this company', 404)
		}

		const results = []

		for (const userId of user_ids) {
			let companyMember = await this.companyMemberSchema.findOne({
				company_id: companyId,
				user_id: userId,
			})

			if (
				companyMember &&
				companyMember.member_role === COMPANY_MEMBER_TYPES.MANAGER
			) {
				throw this.createError('Manager cannot be assigned as worker', 409)
			}

			if (companyMember && !companyMember.status) {
				companyMember.status = true
				companyMember.member_role = COMPANY_MEMBER_TYPES.WORKER
				await companyMember.save()
			}

			if (!companyMember) {
				companyMember = await this.companyMemberSchema.create({
					company_id: companyId,
					user_id: userId,
					member_role: COMPANY_MEMBER_TYPES.WORKER,
				})
			}

			let buildingMember = await this.buildingWorkerSchema.findOne({
				company_id: companyId,
				building_id: buildingId,
				user_id: userId,
			})

			if (buildingMember && buildingMember.status) {
				results.push({
					user_id: userId,
					status: 'already_assigned',
					building_member: buildingMember,
				})
				continue
			}

			if (buildingMember && !buildingMember.status) {
				buildingMember.status = true
				await buildingMember.save()

				results.push({
					user_id: userId,
					status: 'reactivated',
					building_member: buildingMember,
				})
				continue
			}

			buildingMember = await this.buildingWorkerSchema.create({
				company_id: companyId,
				building_id: buildingId,
				user_id: userId,
			})

			results.push({
				user_id: userId,
				status: 'assigned',
				building_member: buildingMember,
			})
		}

		return results
	}

	async assignBuildings(companyId, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		const building_ids = Array.isArray(payload.building_ids)
			? [...new Set(payload.building_ids.map(String))]
			: []

		if (!building_ids.length) {
			throw this.createError('building_ids array is required', 400)
		}

		for (const buildingId of building_ids) {
			if (!mongoose.Types.ObjectId.isValid(buildingId)) {
				throw this.createError(`Invalid building id: ${buildingId}`, 400)
			}
		}

		const company = await this.companySchema.findById(companyId)
		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const buildings = await this.buildingSchema
			.find({
				_id: { $in: building_ids },
			})
			.select('_id building_name company_id')
			.lean()

		if (buildings.length !== building_ids.length) {
			const foundSet = new Set(buildings.map(building => String(building._id)))
			const missing = building_ids.filter(id => !foundSet.has(String(id)))

			throw this.createError(
				`Some buildings not found: ${missing.join(', ')}`,
				404,
			)
		}

		const alreadyAssignedToAnotherCompany = buildings.filter(building => {
			return (
				building.company_id && String(building.company_id) !== String(companyId)
			)
		})

		if (alreadyAssignedToAnotherCompany.length > 0) {
			throw this.createError(
				`Some buildings are already assigned to another company: ${alreadyAssignedToAnotherCompany
					.map(building => building.building_name || building._id)
					.join(', ')}`,
				409,
			)
		}

		await this.buildingSchema.updateMany(
			{
				_id: { $in: building_ids },
			},
			{
				$set: {
					company_id: companyId,
				},
			},
		)

		const updatedBuildings = await this.buildingSchema
			.find({
				_id: { $in: building_ids },
				company_id: companyId,
			})
			.sort({ createdAt: -1 })

		return {
			company_id: company._id,
			company_name: company.company_name,
			assigned_count: updatedBuildings.length,
			building_ids,
			buildings: updatedBuildings,
		}
	}

	async unassignBuildings(companyId, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(companyId)) {
			throw this.createError('Invalid company id', 400)
		}

		const building_ids = Array.isArray(payload.building_ids)
			? [...new Set(payload.building_ids.map(String))]
			: []

		if (!building_ids.length) {
			throw this.createError('building_ids array is required', 400)
		}

		for (const buildingId of building_ids) {
			if (!mongoose.Types.ObjectId.isValid(buildingId)) {
				throw this.createError(`Invalid building id: ${buildingId}`, 400)
			}
		}

		const company = await this.companySchema.findById(companyId)
		if (!company) {
			throw this.createError('Company not found', 404)
		}

		const buildings = await this.buildingSchema
			.find({
				_id: { $in: building_ids },
			})
			.select('_id building_name company_id')
			.lean()

		if (buildings.length !== building_ids.length) {
			const foundSet = new Set(buildings.map(building => String(building._id)))
			const missing = building_ids.filter(id => !foundSet.has(String(id)))

			throw this.createError(
				`Some buildings not found: ${missing.join(', ')}`,
				404,
			)
		}

		const notAssignedToThisCompany = buildings.filter(
			building => String(building.company_id || '') !== String(companyId),
		)

		if (notAssignedToThisCompany.length > 0) {
			throw this.createError(
				`Some buildings are not assigned to this company: ${notAssignedToThisCompany
					.map(building => building.building_name || building._id)
					.join(', ')}`,
				409,
			)
		}

		await this.buildingSchema.updateMany(
			{
				_id: { $in: building_ids },
				company_id: companyId,
			},
			{
				$set: {
					company_id: null,
				},
			},
		)

		return {
			company_id: company._id,
			company_name: company.company_name,
			unassigned_count: building_ids.length,
			building_ids,
		}
	}

	async deleteCompany(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid company id', 400)
		}

		const company = await this.companySchema.findById(id)

		if (!company) {
			throw this.createError('Company not found', 404)
		}

		await this.companyMemberSchema.updateMany(
			{ company_id: id, status: true },
			{ $set: { status: false } },
		)

		const deletedCompany = await this.companySchema.findByIdAndDelete(id)

		if (!deletedCompany) {
			throw this.createError('Company not found or already deleted', 404)
		}

		return deletedCompany
	}
}

module.exports = CompanyService
