const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { UserSchema } = require('./user.model')

class UserService {
	constructor() {
		this.userSchema = UserSchema
	}

	async getUsers(query) {
		const page = Number(query.page) || 1
		const limit = Number(query.limit) || 10
		const skip = (page - 1) * limit

		const filter = {}

		if (query.user_type) {
			filter.user_type = query.user_type
		}

		if (query.status !== undefined) {
			filter.status = query.status === 'true'
		}

		if (query.search) {
			filter.$or = [
				{ name: { $regex: query.search, $options: 'i' } },
				{ email: { $regex: query.search, $options: 'i' } },
				{ phone: { $regex: query.search, $options: 'i' } },
			]
		}

		const [users, total] = await Promise.all([
			this.userSchema
				.find(filter)
				.select('-password')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
			this.userSchema.countDocuments(filter),
		])

		return {
			users,
			pagination: {
				total,
				page,
				limit,
				total_pages: Math.ceil(total / limit),
			},
		}
	}

	async getUserById(userId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error('Invalid user id')
		}

		const user = await this.userSchema.findById(userId).select('-password')

		if (!user) {
			throw new Error('User not found')
		}

		return user
	}

	async createUser(body) {
		const { name, email, phone, password, user_type, status } = body

		const existingUser = await this.userSchema.findOne({ email })

		if (existingUser) {
			throw new Error('User already exists with this email')
		}

		const hashedPassword = await bcrypt.hash(password, 10)

		const user = await this.userSchema.create({
			name,
			email,
			phone,
			password: hashedPassword,
			user_type,
			status,
		})

		return await this.userSchema.findById(user._id).select('-password')
	}

	async updateUser(userId, body) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error('Invalid user id')
		}

		const updateData = {
			name: body.name,
			email: body.email,
			phone: body.phone,
			user_type: body.user_type,
			status: body.status,
			last_selected_company_id: body.last_selected_company_id,
		}

		Object.keys(updateData).forEach(key => {
			if (updateData[key] === undefined) {
				delete updateData[key]
			}
		})

		// email dublicate error handle. boshqa useage dagi emailga o'zgartira olmaydi
		if (body.email) {
			const existingUser = await this.userSchema.findOne({
				email: body.email,
				_id: { $ne: userId }, //$ne = not-equal
			})

			if (existingUser) {
				throw new Error('Email already in use')
			}
		}

		if (body.password) {
			updateData.password = await bcrypt.hash(body.password, 10)
		}

		const updatedUser = await this.userSchema
			.findByIdAndUpdate(userId, updateData, { new: true })
			.select('-password')

		if (!updatedUser) {
			throw new Error('User not found')
		}

		return updatedUser
	}

	async deleteUser(userId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error('Invalid user id')
		}

		const deletedUser = await this.userSchema
			.findByIdAndDelete(userId)
			.select('-password')

		if (!deletedUser) {
			throw new Error('User not found')
		}

		return deletedUser
	}

	async changeUserStatus(userId, status) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error('Invalid user id')
		}

		const updatedUser = await this.userSchema
			.findByIdAndUpdate(userId, { status }, { new: true })
			.select('-password')

		if (!updatedUser) {
			throw new Error('User not found')
		}

		return updatedUser
	}
}

module.exports = UserService
