const router = require('express').Router()
const reportRouter = router
const { nodesCsvHandler } = require('./reportNodesCSV.service')
const reportController = require('./report.controller')

reportRouter.get('/buildings/:buildingId/nodes.csv', nodesCsvHandler)
reportRouter.get('/daily-hwpx', reportController.getReportDailyHWP)
/**
 * GET /api/reports/table1
 *   ?start=YYYY-MM-DD
 *   &end=YYYY-MM-DD
 *   [&buildingId=<ObjectId or name-string>]
 *   [&doorNums=101,102]
 */
reportRouter.get('/table1', reportController.getTable1)

module.exports = reportRouter
