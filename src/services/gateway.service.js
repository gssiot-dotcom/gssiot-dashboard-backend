// services/gateway.service.js
const mongoose = require('mongoose')
const Gateway = require('../schema/Gateway.model')

function normalizeZoneName(v) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length ? s : null
}

class GatewayService {
  async updateZoneNameById(id, zoneName) {
    if (!mongoose.isValidObjectId(id)) {
      throw new Error('invalid gateway id')
    }
    const zone = normalizeZoneName(zoneName)
    if (!zone) throw new Error('zone_name is required')

    const doc = await Gateway.findByIdAndUpdate(
      id,
      { $set: { zone_name: zone } },
      { new: true }
    ).lean()

    if (!doc) throw new Error('gateway not found')
    return {
      ok: true,
      gateway_id: doc._id,
      serial_number: doc.serial_number,
      zone_name: doc.zone_name,
      building_id: doc.building_id,
      gateway_alive: doc.gateway_alive,
      lastSeen: doc.lastSeen,
    }
  }

  async updateZoneNameBySerial(serial, zoneName) {
    const zone = normalizeZoneName(zoneName)
    if (!zone) throw new Error('zone_name is required')

    const doc = await Gateway.findOneAndUpdate(
      { serial_number: String(serial) },
      { $set: { zone_name: zone } },
      { new: true }
    ).lean()

    if (!doc) throw new Error('gateway not found')
    return {
      ok: true,
      gateway_id: doc._id,
      serial_number: doc.serial_number,
      zone_name: doc.zone_name,
      building_id: doc.building_id,
      gateway_alive: doc.gateway_alive,
      lastSeen: doc.lastSeen,
    }
  }
}

module.exports = new GatewayService()
