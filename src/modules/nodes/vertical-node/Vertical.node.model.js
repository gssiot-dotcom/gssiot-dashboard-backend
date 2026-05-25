const mongoose = require('mongoose')
const { Schema } = mongoose

// =========== VerticalNode-History Model =========== //
const VerticalNodeHistorySchema = new Schema(
	{
		nodeNumber: { type: Number, required: true },
		angleX: { type: Number, required: true },
		angleY: { type: Number, required: true },
		gwNumber: { type: Number, required: true },
	},
	{ timestamps: true },
)

const VerticalNodeHistory = mongoose.model(
	'VerticalNodeHistory',
	VerticalNodeHistorySchema,
)

module.exports = { VerticalNodeHistory }
