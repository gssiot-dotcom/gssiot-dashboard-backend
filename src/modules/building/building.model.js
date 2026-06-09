const { default: mongoose } = require('mongoose')
const { ALARM_NODE_TYPES } = require('../../lib/config')

const BUILDING_STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' }
const MEMBER_STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' }

const buildingSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
		},

		number: {
			type: Number,
			default: null,
		},

		address: {
			type: String,
			required: true,
			trim: true,
		},

		buildingType: {
			type: String,
			required: true,
			trim: true,
		},

		buildingPlanImage: {
			type: [String],
			default: [],
			validate: {
				validator: arr => arr.length <= 4,
				message: 'buildingPlanImage maximum 4 images allowed',
			},
		},

		buildingRealImage: {
			type: [String],
			default: [],
			validate: {
				validator: arr => arr.length <= 4,
				message: 'buildingRealImage maximum 4 images allowed',
			},
		},

		buildingStatus: {
			type: String,
			enum: {
				values: Object.values(BUILDING_STATUS),
				message: '{VALUE} is not a valid building status',
			},
			default: BUILDING_STATUS.ACTIVE,
		},

		startDate: {
			type: Date,
			default: null,
		},

		isAssigned: {
			type: Boolean,
			default: false,
		},

		companyId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Company',
			required: true,
		},
	},
	{ timestamps: true },
)

const alarmLevelSchema = new mongoose.Schema({
	buildingId: {
		type: mongoose.Schema.ObjectId,
		ref: 'Building',
		required: true,
	},
	alarmType: {
		type: String,
		required: true,
		enum: {
			values: Object.values(ALARM_NODE_TYPES),
			message: '{VALUE} is not a valid alarm type',
		},
	},
	green: { type: Number, default: 0 },
	yellow: { type: Number, default: 0 },
	red: { type: Number, default: 0 },
})

const gatewayAlarmNodeSettingSchema = new mongoose.Schema(
	{
		alarmEnabled: { type: Boolean, default: false },
		alarmLevel1: { type: Number, default: null },
		alarmLevel2: { type: Number, default: null },
		alarmLevel3: { type: Number, default: null },
		faultFilterNodes: { type: [Number], default: [] },
	},
	{ _id: false },
)

const gatewayAlarmSettingSchema = new mongoose.Schema(
	{
		gatewayId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Gateway',
			required: true,
			unique: true,
		},
		gatewaySerialNum: {
			type: String,
			default: null,
			trim: true,
		},
		angle: {
			type: gatewayAlarmNodeSettingSchema,
			default: () => ({}),
		},
		vertical: {
			type: gatewayAlarmNodeSettingSchema,
			default: () => ({}),
		},
		updatedBy: {
			type: mongoose.Schema.ObjectId,
			ref: 'User',
			default: null,
		},
	},
	{ timestamps: true },
)

const buildingMemberSchema = new mongoose.Schema(
	{
		companyId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Company',
			required: true,
		},

		buildingId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Building',
			required: true,
		},

		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
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

buildingMemberSchema.index(
	{ companyId: 1, buildingId: 1, userId: 1 },
	{ unique: true },
)

buildingSchema.index({ companyId: 1, buildingStatus: 1 })
buildingSchema.index({ companyId: 1, title: 1 })

const BuildingSchema = mongoose.model('Building', buildingSchema)
const BuildingWorkerSchema = mongoose.model(
	'Building-worker',
	buildingMemberSchema,
)

const BuildingAlarmLevelSchema = mongoose.model(
	'BuildingAlarmLevel',
	alarmLevelSchema,
)
const GatewayAlarmSettingSchema = mongoose.model(
	'GatewayAlarmSetting',
	gatewayAlarmSettingSchema,
)

module.exports = {
	BuildingSchema,
	BuildingWorkerSchema,
	BuildingAlarmLevelSchema,
	GatewayAlarmSettingSchema,
}
