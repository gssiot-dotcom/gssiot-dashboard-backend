// const express = require('express')
// const company_router = express.Router()
// const companyController = require('../controllers/company.controller')
// const uploadImage = require('../middlewares/uploadImage')

// // ========== Building related endpoints ======= //
// company_router.post('/create-building', companyController.createBuilding)
// company_router.get(
// 	'/get-active-buildings',
// 	companyController.getActiveBuildings
// )
// company_router.get('/get-buildings', companyController.getBuildings)
// company_router.get('/buildings/:id', companyController.getBuildingNodes)
// company_router.get(
// 	'/buildings/:id/angle-nodes',
// 	companyController.getBuildingAngleNodes
// )
// company_router.get(
// 	'/buildings/:id/angle-nodes/summary',
// 	companyController.getAngleNodeSummary
// )
// company_router.delete(
// 	'/delete/building/:buildingId',
// 	companyController.deleteBuilding
// )
// // 🔹 여기 추가
// company_router.put(
// 	'/building/change-gateway-building',
// 	companyController.changeGatewayBuilding
// )

// company_router.put('/building/set-alarm-level', companyController.setAlarmLevel)

// // ========== Client related endpoints ======= //
// company_router.post('/create-client', companyController.createClient)
// company_router.get('/clients', companyController.getComanies)
// company_router.get('/clients/:id', companyController.getClient)
// company_router.delete(
// 	'/delete/client/:clientId',
// 	companyController.deleteCompany
// )

// //  =========================  Boss Client user related endpoints ================ //
// company_router.post('/boss-clients', companyController.getBossClients)
// company_router.post('/gateway/wake_up', companyController.wakeUpOfficeGateway)

// // ======================================================= //
// company_router.put(
// 	'/upload-company-plan',
// 	uploadImage.single('image'),
// 	companyController.uploadBuildingImage
// )

// module.exports = company_router
