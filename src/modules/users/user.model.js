const { Schema, model, models } = require('mongoose')
const { USER_TYPES } = require('../../lib/config')

const userSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		phone: {
			type: String,
			default: '',
		},
		password: {
			type: String,
			required: true,
		},
		userType: {
			type: String,
			enum: {
				values: USER_TYPES,
				message: '{VALUE} is not among permitted user type',
			},
			required: true,
		},
		isAssigned: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true },
)

userSchema.index({ userType: 1, isAssigned: 1 })

const otpSchema = new Schema({
	userEmail: {
		type: String,
		required: true,
	},
	otp: {
		type: Number,
		required: true,
	},
	expiresAt: {
		type: Date,
		required: true,
	},
})

const OtpSchema = model('Otp', otpSchema)
const UserSchema = model('User', userSchema)

module.exports = { UserSchema, OtpSchema }
