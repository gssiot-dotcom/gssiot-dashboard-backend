const mongoose = require('mongoose')
const { BuildingSchema, BuildingWorkerSchema } = require('./building.model')
const { UserSchema } = require('../users/user.model')

class BuildingService {
	constructor() {
		this.buildingSchema = BuildingSchema
		this.buildingWorkerSchema = BuildingWorkerSchema
		this.userSchema = UserSchema
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	normalizeAlarmLevels(level = {}) {
		return {
			blue: Number(level.blue ?? 0),
			green: Number(level.green ?? 0),
			yellow: Number(level.yellow ?? 0),
			red: Number(level.red ?? 0),
		}
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

	async getBuildings(query = {}) {
		const filter = {}

		if (query.company_id) {
			if (!mongoose.Types.ObjectId.isValid(query.company_id)) {
				throw this.createError('Invalid company id', 400)
			}

			filter.company_id = query.company_id
		}

		const buildings = await this.buildingSchema
			.find(filter)
			.sort({ createdAt: -1 })

		return buildings
	}

	async getActiveBuildings(query = {}) {
		const filter = { building_status: true }

		if (query.company_id) {
			if (!mongoose.Types.ObjectId.isValid(query.company_id)) {
				throw this.createError('Invalid company id', 400)
			}

			filter.company_id = query.company_id
		}

		const buildings = await this.buildingSchema
			.find(filter)
			.sort({ createdAt: -1 })

		return buildings
	}

	async getBuildingDetail(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid building id', 400)
		}

		const building = await this.buildingSchema.findById(id)

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		return building
	}

	async updateBuildingStatus(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid building id', 400)
		}

		const building = await this.buildingSchema.findOneAndUpdate(
			{ _id: id },
			[{ $set: { building_status: { $not: '$building_status' } } }],
			{ new: true },
		)

		if (!building) {
			throw this.createError('Building not found', 404)
		}

		return building
	}

	async updateBuilding(id, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid building id', 400)
		}

		const allowedFields = [
			'building_name',
			'building_num',
			'building_addr',
			'building_plan_img',
			'building_status',
			'permit_date',
			'expiry_date',
			'company_id',
		]

		const updateData = {}

		for (const field of allowedFields) {
			if (payload[field] !== undefined) {
				updateData[field] = payload[field]
			}
		}

		if (updateData.building_name !== undefined) {
			updateData.building_name = String(updateData.building_name).trim()
			if (!updateData.building_name) {
				throw this.createError('building_name cannot be empty', 400)
			}
		}

		if (updateData.building_addr !== undefined) {
			updateData.building_addr = String(updateData.building_addr).trim()
			if (!updateData.building_addr) {
				throw this.createError('building_addr cannot be empty', 400)
			}
		}

		if (updateData.company_id !== undefined) {
			if (!mongoose.Types.ObjectId.isValid(updateData.company_id)) {
				throw this.createError('Invalid company id', 400)
			}
		}

		if (Object.keys(updateData).length === 0) {
			throw this.createError('No valid fields provided for update', 400)
		}

		const updatedBuilding = await this.buildingSchema.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true },
		)

		if (!updatedBuilding) {
			throw this.createError('Building not found', 404)
		}

		return updatedBuilding
	}

	async updateAlarmLevels(id, payload = {}) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid building id', 400)
		}

		const updateData = {}

		if (payload.angle_alarm_level !== undefined) {
			updateData.angle_alarm_level = this.normalizeAlarmLevels(
				payload.angle_alarm_level,
			)
		}

		if (payload.gangform_alarm_level !== undefined) {
			updateData.gangform_alarm_level = this.normalizeAlarmLevels(
				payload.gangform_alarm_level,
			)
		}

		if (Object.keys(updateData).length === 0) {
			throw this.createError(
				'angle_alarm_level or gangform_alarm_level is required',
				400,
			)
		}

		const updatedBuilding = await this.buildingSchema.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true },
		)

		if (!updatedBuilding) {
			throw this.createError('Building not found', 404)
		}

		return updatedBuilding
	}

	async getBuildingWorkers(buildingId) {
		if (!mongoose.Types.ObjectId.isValid(buildingId)) {
			throw this.createError('Invalid building id', 400)
		}

		const building = await this.buildingSchema.findById(buildingId)
		if (!building) {
			throw this.createError('Building not found', 404)
		}

		const workers = await this.buildingWorkerSchema
			.find({
				building_id: buildingId,
				status: true,
			})
			.populate('user_id', 'name email phone user_type')
			.populate('assigned_by', 'name email')
			.sort({ createdAt: -1 })

		return workers
	}

	async deleteBuilding(id) {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw this.createError('Invalid building id', 400)
		}

		const building = await this.buildingSchema.findById(id)
		if (!building) {
			throw this.createError('Building not found', 404)
		}

		await this.buildingWorkerSchema.updateMany(
			{ building_id: id, status: true },
			{ $set: { status: false } },
		)

		const deletedBuilding = await this.buildingSchema.findByIdAndDelete(id)

		if (!deletedBuilding) {
			throw this.createError('Building not found or already deleted', 404)
		}

		return deletedBuilding
	}
}

module.exports = BuildingService
