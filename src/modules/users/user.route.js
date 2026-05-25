const express = require('express')
const router = express.Router()
const userController = require('./user.controller')

const { isAuth } = require('../../middlewares/auth.middleware')
const { isAdmin } = require('../../middlewares/admin.middleware')
const { selfOrAdmin } = require('../../middlewares/role.middleware')

// ============================== Only For logged in users =========================== //
router.get('/:id', isAuth, userController.getUserById)

// ============================== Only For Admin users =============================== //
router.get('/', isAuth, isAdmin, userController.getUsers)
router.post('/', isAuth, isAdmin, userController.createUser)
router.delete('/:id', isAuth, isAdmin, userController.deleteUser)
router.patch('/:id/status', isAuth, isAdmin, userController.changeUserStatus)

// ============================== Only For Self or Admin users ======================== //
router.put('/:id', isAuth, selfOrAdmin, userController.updateUser)

module.exports = router
