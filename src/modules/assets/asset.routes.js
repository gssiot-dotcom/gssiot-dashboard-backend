const express = require('express')
const assetController = require('./asset.controller')

// const authMiddleware = require('../middlewares/auth.middleware')

const router = express.Router()

// router.use(authMiddleware)

router.post('/company/upload-url', assetController.createUploadUrl)
router.post('/company/save', assetController.saveAsset)
router.post('/company/remove', assetController.removeAsset)

module.exports = router
