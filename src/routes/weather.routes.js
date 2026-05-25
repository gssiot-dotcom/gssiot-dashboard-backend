// routes/weather.routes.js
const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/weather.controller')

router.post('/', ctrl.createWeather)         // 등록(단건/배열)
router.get('/', ctrl.getWeatherList)         // 목록 조회
router.get('/latest', ctrl.getLatestWeather) // 최신 1건
router.get('/:id', ctrl.getWeatherById)      // 단건 조회
router.get('/:id/wind-series', ctrl.getWindSeriesForBuilding) //풍속 시간 반환

module.exports = router
