// schema/Weather.model.js
const mongoose = require('mongoose')

const WIND_DIR = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW',
]
const EFF_LABELS = { 1: '상륙', 2: '직접영향', 3: '간접영향', 4: '없음' }
const EFF_CODES = { 상륙: 1, 직접영향: 2, 간접영향: 3, 없음: 4 }

function add9h(v) {
	const t = new Date(v || Date.now())
	return new Date(t.getTime() + 9 * 60 * 60 * 1000)
}

const weatherSchema = new mongoose.Schema(
	{
		building: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Building',
			required: true,
			index: true,
		},
		weather: { type: String, required: true },
		wind_direction: { type: String, enum: WIND_DIR },
		temperature: { type: Number },
		humidity: { type: Number, min: 0, max: 100 },
		wind_speed: { type: Number, min: 0 },

		// 숫자 코드
		typhoon_eff: {
			type: Number,
			enum: [1, 2, 3, 4],
			default: 4,
			set(v) {
				// 숫자나 문자열 모두 입력 가능
				const n = typeof v === 'string' ? EFF_CODES[v] ?? parseInt(v, 10) : v
				const code = [1, 2, 3, 4].includes(n) ? n : 4
				// 코드에 맞는 라벨을 동시 세팅
				this.set('typhoon_eff_label', EFF_LABELS[code])
				return code
			},
		},
		// 사람이 읽는 라벨(중복 저장)
		typhoon_eff_label: {
			type: String,
			enum: ['상륙', '직접영향', '간접영향', '없음'],
			default: '없음',
		},

		timestamp: { type: Date, default: Date.now, set: add9h },
	},
	{ versionKey: false, timestamps: false }
)

weatherSchema.index({ building: 1, timestamp: -1 })
const Weather = mongoose.model('Weather', weatherSchema)

module.exports = Weather
