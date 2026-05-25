const mongoose = require('mongoose')
const { gateway_type_enums, GATEWAY_TYPES } = require('../../lib/config')
const GATEWAY_STATUS = { ONLINE: 'online', OFFLINE: 'offline' }

const gatewaySchema = new mongoose.Schema(
	{
		serialNumber: {
			type: String,
			required: true,
			trim: true,
		},

		gatewayType: {
			type: String,
			required: true,
			enum: {
				values: Object.values(GATEWAY_TYPES),
				message: '{VALUE} is not permitted to gateway type',
			},
			default: GATEWAY_TYPES.NODES,
		},

		isAssigned: {
			type: Boolean,
			default: false,
		},

		companyId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Company',
			default: null,
		},

		buildingId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Building',
			default: null,
		},

		installedLocation: {
			type: String,
			default: null,
			trim: true,
		},

		gatewayStatus: {
			type: String,
			enum: {
				values: Object.values(GATEWAY_STATUS),
				message: '{VALUE} is not a valid gateway status',
			},
			default: GATEWAY_STATUS.OFFLINE,
		},

		lastSeenAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true },
)

gatewaySchema.index({ serialNumber: 1 }, { unique: true })
gatewaySchema.index({ companyId: 1, gatewayStatus: 1 })
gatewaySchema.index({ companyId: 1, buildingId: 1, gatewayStatus: 1 })
gatewaySchema.index({ buildingId: 1, gatewayStatus: 1 })
gatewaySchema.index({ gatewayStatus: 1, lastSeenAt: -1 })

const Gateway = mongoose.model('Gateway', gatewaySchema)
module.exports = Gateway
