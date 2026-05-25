const mongoose = require('mongoose')
const { COMPANY_MEMBER_TYPES } = require('../../lib/config')
const MEMBER_STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' }
const COMPANY_STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' }

const companySchema = new mongoose.Schema(
	{
		companyName: {
			type: String,
			required: true,
			trim: true,
		},
		companyCode: {
			type: String,
			required: false,
			trim: true,
		},
		companyAddress: {
			type: String,
			required: true,
			trim: true,
		},
		companyTel: {
			type: String,
			default: null,
		},
		companyEmail: {
			type: String,
			default: null,
			trim: true,
			lowercase: true,
		},
		companyLogo: {
			type: String,
			default: null,
		},

		companyStatus: {
			type: String,
			enum: {
				values: Object.values(COMPANY_STATUS),
				message: '{VALUE} is not a valid company status',
			},
			default: COMPANY_STATUS.ACTIVE,
		},
	},
	{ timestamps: true },
)

const companyMemberSchema = new mongoose.Schema(
	{
		companyId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Company',
			required: true,
		},

		memberId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},

		memberRole: {
			type: String,
			enum: {
				values: Object.values(COMPANY_MEMBER_TYPES),
				message: '{VALUE} is not permitted for memberRole',
			},
			required: true,
		},

		status: {
			type: String,
			enum: {
				values: Object.values(MEMBER_STATUS),
				message: '{VALUE} is not a valid member status',
			},
			default: MEMBER_STATUS.ACTIVE,
		},
	},
	{ timestamps: true },
)

companySchema.index({ companyName: 1 })
companySchema.index({ companyStatus: 1 })

companyMemberSchema.index({ companyId: 1, memberId: 1 }, { unique: true })
companyMemberSchema.index({ memberId: 1, status: 1 })
companyMemberSchema.index({ companyId: 1, status: 1 })

const CompanySchema = mongoose.model('Company', companySchema)
const CompanyMemberSchema = mongoose.model(
	'Company-member',
	companyMemberSchema,
)
module.exports = { CompanySchema, CompanyMemberSchema }
