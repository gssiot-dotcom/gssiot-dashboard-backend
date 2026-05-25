// schema/AlertLog.model.js
const mongoose = require('mongoose')

const alertLogSchema = new mongoose.Schema(
	{
		building: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Building',
			required: true,
		},
		gateway: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Gateway',
			default: null,
		},
		gateway_serial: { type: String, required: true },
		node: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Angle-Node',
			default: null,
		},
		doorNum: { type: Number, required: true },
		level: { type: String, enum: ['yellow', 'red'], required: true },
		metric: { type: String, required: true },
		value: { type: Number, required: true },
		threshold: { type: Number, required: true },
		raw: { type: Object, default: null },

		// ✅ 그냥 UTC 기준 Date 저장 (MongoDB 내부적으로 UTC 저장됨)
		createdAt: { type: Date, default: Date.now },
	},
	{
		versionKey: false,
	}
)

// 인덱스
alertLogSchema.index({ building: 1, createdAt: -1 })
alertLogSchema.index({ level: 1, createdAt: -1 })
alertLogSchema.index({ gateway_serial: 1, doorNum: 1, createdAt: -1 })

const AlertLog = mongoose.model('AlertLog', alertLogSchema)
module.exports = AlertLog
