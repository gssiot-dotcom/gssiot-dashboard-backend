// services/Heartbeat.service.js
const { logger } = require('../lib/logger')
const GatewaySchema = require('../modules/gateways/gateway.model')
const { AngleNode } = require('../modules/nodes/angle-node/angleNode.model')
const NodeSchema = require('../modules/nodes/node.model')
const GATEWAY_STATUS = { ONLINE: 'online', OFFLINE: 'offline' }

// ===== Loop sikl bo'lib har 10 minutda bir marttadan db ni tekshiradi. agar oxirgi kelgan data kelganiga 1 soatdan oshgan bo'lsa product-status ni false qiladi. bu esa product bilan connection uzilganini bildiradi.

function startHeartbeatJob({
	intervalMs = 20 * 60 * 1000,
	windowMs = 30 * 60 * 1000,
} = {}) {
	// intervalMs: necha daqiqada tekshiramiz (default 5 minut)
	// windowMs: "tirik" deb hisoblash oynasi (default 1 soat)

	const run = async () => {
		logger(
			'===================== Nodes and gateways life checking is on ====================',
		)
		const cutoff = new Date(Date.now() - windowMs)

		// Gateway: 1 soat ichida kamida bitta node dan data bo‘lsa lastSeen gatewayga qo‘yilgan bo‘ladi → true bo‘lib qoladi.
		// endi lastSeen < cutoff bo‘lgan gateway larni false qilamiz, >= bo‘lsa true (ikkinchi query ixtiyoriy)
		await GatewaySchema.updateMany(
			{
				$or: [
					{ lastSeenAt: { $exists: false } },
					{ lastSeenAt: { $lt: cutoff } },
				],
			},
			{ $set: { gatewayStatus: GATEWAY_STATUS.OFFLINE } },
		)
		await GatewaySchema.updateMany(
			{ lastSeenAt: { $gte: cutoff } },
			{ $set: { gatewayStatus: GATEWAY_STATUS.ONLINE } },
		)

		// Node lar uchun ham xuddi shu
		await NodeSchema.updateMany(
			{
				$or: [
					{ lastSeenAt: { $exists: false } },
					{ lastSeenAt: { $lt: cutoff } },
				],
			},
			{ $set: { status: 'offline' } },
		)

		// Agar xohlasangiz shu yerda “o‘zgarganlar”ni socket orqali admin dashboardga emit qilishingiz ham mumkin
	}

	// darhol bir marta yuritib oling, keyin intervalla
	run().catch(console.error)
	const timer = setInterval(() => run().catch(console.error), intervalMs)

	// Graceful shutdown
	const stop = () => clearInterval(timer)
	return { stop }
}

module.exports = { startHeartbeatJob }
