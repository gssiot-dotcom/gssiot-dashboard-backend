const mongoose = require('mongoose')
const { NODE_TYPE } = require('../../lib/config')
const NODE_STATUS = 'normal' | 'warning' | 'danger' | 'offline'

// ======== Schemas of Model ========== //
const nodeSchema = new mongoose.Schema(
	{
		number: {
			type: Number,
			required: true,
		},

		nodeType: {
			type: String,
			required: true,
			enum: Object.values(NODE_TYPE),
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

		gatewayId: {
			type: mongoose.Schema.ObjectId,
			ref: 'Gateway',
			default: null,
		},

		status: {
			type: String,
			enum: Object.values(NODE_STATUS),
			default: 'safe',
		},

		installedLocation: {
			type: String,
			default: '',
			trim: true,
		},

		installLocationImg: {
			type: String,
			default: null,
		},

		isAssigned: {
			type: Boolean,
			default: false,
		},

		doorState: {
			type: Number,
			default: 0,
		},

		batteryLevel: {
			type: Number,
			default: 0,
		},

		angleX: {
			type: Number,
			default: 0,
		},

		angleY: {
			type: Number,
			default: 0,
		},

		calibratedX: {
			type: Number,
			default: 0,
		},

		calibratedY: {
			type: Number,
			default: 0,
		},

		saveStatus: {
			type: Boolean,
			default: true,
		},

		saveStatusLastChange: {
			type: Date,
			default: Date.now,
		},

		lastSeenAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true },
)

nodeSchema.index({ number: 1 }, { unique: true })
nodeSchema.index({ companyId: 1, status: 1 })
nodeSchema.index({ companyId: 1, gatewayId: 1, nodeType: 1 })
nodeSchema.index({ gatewayId: 1, nodeType: 1 })
nodeSchema.index({ status: 1, lastSeen: -1 })

// ============ Exports of schemas ============ //

const NodeSchema = mongoose.model('Node', nodeSchema)
module.exports = NodeSchema
