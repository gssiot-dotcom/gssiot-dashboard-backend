// controllers/alertLog.controller.js
const express = require('express')
const alertController = require('./alert.controller')

const alertRouter = express.Router()

// =============== 기본 조회 (페이징) =============== //
alertRouter.get('/', alertController.getAlertions)

// =============== 단일 조회 =============== //
alertRouter.get('/:id', alertController.getAlertByID)

// =============== 통계 요약 =============== //
alertRouter.get('/stats/summary', alertController.getStatsSummary)

// =============== 최근 N개 =============== //
alertRouter.get('/recent/list', alertController.getAlertRecentList)

// =============== CSV 다운로드 =============== //
alertRouter.get('/export/csv', alertController.exportCSV)

module.exports = alertRouter
