// services/angleNode.service.js
const AngleNode = require('../schema/Angle.node.model')

/**
 * 단일 AngleNode position 설정 (doorNum 기준)
 * @param {Number|String} doorNum
 * @param {String} position
 */
async function setAngleNodePosition(doorNum, position) {
  const n = Number(doorNum)
  if (!Number.isFinite(n)) {
    throw new Error('doorNum must be a valid number')
  }
  if (!position || typeof position !== 'string') {
    throw new Error('position must be a non-empty string')
  }

  const node = await AngleNode.findOneAndUpdate(
    { doorNum: n },
    { $set: { position } },
    { new: true }
  )

  if (!node) {
    throw new Error(`AngleNode with doorNum ${n} not found`)
  }

  return node
}

/**
 * 여러 개 AngleNode position 설정 (배열 [{doorNum, position}, ...])
 * @param {Array<{doorNum:number, position:string}>} positions
 */
async function setAngleNodePositions(positions) {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error('positions must be a non-empty array')
  }

  const results = []

  for (const item of positions) {
    const n = Number(item.doorNum)
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid doorNum: ${item.doorNum}`)
    }
    if (!item.position || typeof item.position !== 'string') {
      throw new Error(`Invalid position for doorNum: ${item.doorNum}`)
    }

    const node = await AngleNode.findOneAndUpdate(
      { doorNum: n },
      { $set: { position: item.position } },
      { new: true }
    )

    if (!node) {
      throw new Error(`AngleNode with doorNum ${n} not found`)
    }

    results.push(node)
  }

  return results
}

module.exports = {
  setAngleNodePosition,
  setAngleNodePositions,
}
