// routes/gateway.position.routes.js
const express = require('express')
const router = express.Router()
const gatewayService = require('../services/gateway.service')

// PATCH /api/gateways/:id/position
router.patch('/:id/position', async (req, res) => {
    try {
        const result = await gatewayService.updateZoneNameById(req.params.id, req.body?.zone_name)
        res.json(result)
    } catch (e) {
        const msg = e?.message || 'server error'
        const code =
            msg.includes('invalid gateway id') ? 400 :
                msg.includes('zone_name is required') ? 400 :
                    msg.includes('gateway not found') ? 404 : 500
        res.status(code).json({ ok: false, message: msg })
    }
})

// PATCH /api/gateways/by-serial/:serial/position
router.patch('/by-serial/:serial/position', async (req, res) => {
    try {
        const result = await gatewayService.updateZoneNameBySerial(req.params.serial, req.body?.zone_name)
        res.json(result)
    } catch (e) {
        const msg = e?.message || 'server error'
        const code =
            msg.includes('zone_name is required') ? 400 :
                msg.includes('gateway not found') ? 404 : 500
        res.status(code).json({ ok: false, message: msg })
    }
})

module.exports = router
