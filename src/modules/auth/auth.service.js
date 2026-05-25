const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { UserSchema } = require('../users/user.model')
const { SIGNUP_USER_TYPES } = require('../../lib/config')

const PRIVATE_SELECT = '-password -__v'

class AuthService {
	constructor() {
		this.userSchema = UserSchema
	}

	createError(message, statusCode = 400) {
		const error = new Error(message)
		error.statusCode = statusCode
		return error
	}

	generateAccessToken(user) {
		return jwt.sign(
			{
				id: user._id,
				email: user.email,
				userType: user.userType,
			},
			process.env.JWT_SECRET_KEY,
			{
				expiresIn: process.env.JWT_EXPIRES_IN || '7d',
			},
		)
	}

	setAuthCookie(res, token) {
		const isProduction = process.env.NODE_ENV === 'production'
		const secureCookie =
			process.env.COOKIE_SECURE?.toLowerCase() === 'false'
				? false
				: isProduction
		const sameSite =
			process.env.COOKIE_SAME_SITE || (secureCookie ? 'none' : 'lax')

		res.cookie('access_token', token, {
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
			path: '/',
			maxAge: 7 * 24 * 60 * 60 * 1000,
		})
	}

	clearAuthCookie(res) {
		const isProduction = process.env.NODE_ENV === 'production'
		const secureCookie =
			process.env.COOKIE_SECURE?.toLowerCase() === 'false'
				? false
				: isProduction
		const sameSite =
			process.env.COOKIE_SAME_SITE || (secureCookie ? 'none' : 'lax')

		res.clearCookie('access_token', {
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
		})
	}

	async register(payload = {}) {
		const name = payload.name?.trim()
		const email = payload.email?.trim()?.toLowerCase()
		const password = payload.password
		const phone = payload.phone || ''
		const userType = payload.userType ?? 'user'
		const profile_img = payload.profile_img || ''

		if (!name) {
			throw this.createError('Name is required', 400)
		}

		if (!email) {
			throw this.createError('Email is required', 400)
		}

		if (!password) {
			throw this.createError('Password is required', 400)
		}

		if (!SIGNUP_USER_TYPES.includes(userType)) {
			throw this.createError('Invalid user type', 400)
		}

		const existingUser = await this.userSchema.findOne({ email })
		if (existingUser) {
			throw this.createError('Email already exists', 409)
		}

		const hashedPassword = await bcrypt.hash(password, 10)

		const user = await this.userSchema.create({
			name,
			email,
			password: hashedPassword,
			phone,
			profile_img,
			userType: userType,
		})

		const token = this.generateAccessToken(user)

		const safeUser = await this.userSchema
			.findById(user._id)
			.select(PRIVATE_SELECT)

		return {
			user: safeUser,
			token,
		}
	}

	async login(payload = {}) {
		const email = payload.email?.trim()?.toLowerCase()
		const password = payload.password

		if (!email) {
			throw this.createError('Email is required', 400)
		}

		if (!password) {
			throw this.createError('Password is required', 400)
		}

		const user = await this.userSchema.findOne({ email })
		if (!user) {
			throw this.createError('Invalid email or password', 401)
		}

		const isMatch = await bcrypt.compare(password, user.password)
		if (!isMatch) {
			throw this.createError('Invalid email or password', 401)
		}

		const token = this.generateAccessToken(user)

		const safeUser = await this.userSchema
			.findById(user._id)
			.select(PRIVATE_SELECT)

		return {
			user: safeUser,
			token,
		}
	}

	async getMe(userId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw this.createError('Invalid user id', 400)
		}

		const user = await this.userSchema.findById(userId).select(PRIVATE_SELECT)

		if (!user) {
			throw this.createError('User not found', 404)
		}

		return user
	}
}

module.exports = AuthService
