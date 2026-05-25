const { Telegraf } = require('telegraf') // Import qilishning to‘g‘ri usuli
const mongoose = require('mongoose')
const NodeSchema = require('../schema/Node.model')
const User = require('../schema/User.model') // User modelini chaqirish
const BuildingSchema = require('../schema/Building.model') //
const axios = require('axios')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN) // .env dan bot tokenni olish

bot.start(async ctx => {
	try {
		const telegramId = ctx.from.id
		const args = ctx.message.text.split(' ')
		let userId = args[1]

		if (!userId) {
			return ctx.reply(
				'사이트 프로필과 연결하려면 올바른 링크를 통해 접속하세요.',
			)
		}

		// MongoDB ObjectId formatiga o‘tkazish
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return ctx.reply('❌ 잘못된 사용자 ID입니다!')
		}
		userId = new mongoose.Types.ObjectId(userId)

		// MongoDB dagi foydalanuvchini topish
		const user = await User.findById(userId)
		if (!user) {
			return ctx.reply(
				'회원님의 프로필을 찾을 수 없습니다. 먼저 사이트에서 회원가입을 해주세요.',
			)
		}

		// Telegram ID ni saqlash
		user.telegram_id = String(telegramId)
		await user.save()

		ctx.reply(
			'✅ 회원님의 텔레그램 계정이 성공적으로 연결되었습니다. 이제 사이트로 돌아가 로그인하실 수 있습니다!',
		)
	} catch (error) {
		console.error('Xatolik:', error)
		ctx.reply('❌ 사용자 정보를 저장하는 동안 오류가 발생했습니다.')
	}
})

bot.launch() // Botni ishga tushiramiz
console.log('🤖 텔레그램 봇이 실행되었습니다!')

async function notifyUsersOfOpenDoor(doorNum) {
	try {
		// 1. NodeSchema orqali gateway_id ni olish
		const node = await NodeSchema.findOne({ doorNum })
		if (!node || !node.gateway_id) {
			console.log(`❌ 게이트웨이 ID를 찾을 수 없습니다. (doorNum: ${doorNum})`)
			return
		}

		// 2. BuildingSchema orqali users arrayni olish
		const buildings = await BuildingSchema.find({
			gateway_sets: node.gateway_id,
		})

		if (!buildings || buildings.length === 0) {
			console.log(
				`❌ 건물을 찾을 수 없거나 사용자가 없습니다. (gateway_id: ${node.gateway_id})`,
			)
			return
		}
		// 3. Barcha binolardagi user ID larni yig‘ish (unikal qilish)
		let allUserIds = new Set()
		for (const building of buildings) {
			if (building.users && building.users.length > 0) {
				building.users.forEach(userId => {
					allUserIds.add(userId.toString())
				})
			}
		}

		// 4. Userlarni olish
		const users = await User.find({ _id: { $in: Array.from(allUserIds) } })
		const telegramUsers = users.filter(user => user.telegram_id) // Telegram ID si bor userlar

		if (telegramUsers.length === 0) {
			console.log('❌ Hech qanday bog‘langan Telegram foydalanuvchi yo‘q.')
			return
		}

		const message = `🚪 ${doorNum} 번 노드 문이 열려 있습니다! 확인해 주세요.

     경로:
     🏢 building: ${buildings.map(b => b.building_name).join(', ')}
     🏢 building-number: ${buildings.map(b => b.building_num).join(', ')}

     infogssiot.com/client/dashboard/clients`

		// 5. Har bir userga faqat 1 marta xabar yuborish
		for (const user of telegramUsers) {
			await sendTelegramMessageToUser(user._id, message)
		}

		console.log(
			`✅ ${telegramUsers.length} ta foydalanuvchiga xabar yuborildi.`,
		)
	} catch (error) {
		console.error('Xatolik:', error)
	}
}

// ========== Telegram message Sender to users ========= //
async function sendTelegramMessageToUser(userId, message) {
	const user = await User.findById(userId)
	if (!user || !user.telegram_id) {
		console.log('Foydalanuvchining Telegram ID si yo‘q.')
		return
	}

	try {
		const telegramApiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
		await axios.post(telegramApiUrl, {
			chat_id: user.telegram_id,
			text: message,
		})
	} catch (error) {
		console.error('Xabar yuborishda xatolik:', error)
	}
}

module.exports = { bot, notifyUsersOfOpenDoor } // Express serverda foydalanish uchun eksport qilamiz
