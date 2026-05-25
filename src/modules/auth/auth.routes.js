const router = require('express').Router()
const authController = require('./auth.controller')

// middleware pathni projectingizga moslang
const { isAuth } = require('../../middlewares/auth.middleware')

router.post('/signup', authController.register)
router.post('/login', authController.login)
router.post('/logout', isAuth, authController.logout)
router.get('/me', isAuth, authController.me)

module.exports = router

//// ================== NEW ROUTER ENDPOINTS ============== ////
// POST /auth/register
// POST /auth/login
// POST /auth/logout
// GET  /auth/me

//  ================== auth.rotue.js belong .env variables =================== //
// JWT_SECRET_KEY=your_super_secret_key
// JWT_EXPIRES_IN=7d
// NODE_ENV=development
