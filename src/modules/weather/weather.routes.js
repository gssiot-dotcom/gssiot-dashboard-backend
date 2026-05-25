// routes/weather.routes.js
const express = require('express')
const weather_outer = express.Router()
const ctrl = require('../weather/weather.controller')

weather_outer.post('/', ctrl.createWeather) // 등록(단건/배열)
weather_outer.get('/', ctrl.getWeatherList) // 목록 조회
weather_outer.get('/latest', ctrl.getLatestWeather) // 최신 1건
weather_outer.get('/:id', ctrl.getWeatherById) // 단건 조회
weather_outer.get('/:id/wind-series', ctrl.getWindSeriesForBuilding) //풍속 시간 반환

module.exports = weather_outer
