const axios = require('axios')

// 간단 캐시(프로세스 메모리). 운영은 Redis나 컬렉션 권장.
const cache = new Map()

exports.geocodeAddress = async (address) => {
  if (!address) return null
  if (cache.has(address)) return cache.get(address)

  const url = 'https://nominatim.openstreetmap.org/search'
  const params = { q: address, format: 'json', addressdetails: 0, limit: 1 }
  const headers = { 'User-Agent': 'gssiot-weather-ingest/1.0' }

  const { data } = await axios.get(url, { params, headers })
  if (!Array.isArray(data) || data.length === 0) return null

  const { lat, lon } = data[0]
  const coord = { lat: Number(lat), lon: Number(lon) }
  cache.set(address, coord)
  return coord
}
