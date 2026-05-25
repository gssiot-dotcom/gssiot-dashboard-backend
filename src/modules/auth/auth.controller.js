const AuthService = require('./auth.service')
const { sendSuccess, sendFail } = require('../../lib/http.response') // pathni moslang
const { logError, logger } = require('../../lib/logger')
const authService = new AuthService()

let authController = module.exports

authController.register = async (req, res, next) => {
	try {
		logger('request: auth-register')
		const result = await authService.register(req.body)
		authService.setAuthCookie(res, result.token)
		return sendSuccess(res, {
			message: 'User registered successfully',
			data: { user: result.user, accessToken: result.token },
			statusCode: 201,
		})
	} catch (error) {
		return sendFail(res, error)
	}
}

authController.login = async (req, res, next) => {
	try {
		logger('request: auth-login')

		const result = await authService.login(req.body)
		authService.setAuthCookie(res, result.token)

		return sendSuccess(res, {
			message: 'Login successful',
			data: { user: result.user, accessToken: result.token },
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Auth: login', error)
		return sendFail(res, error)
	}
}

authController.logout = async (req, res, next) => {
	try {
		logger('request: auth-logout')

		authService.clearAuthCookie(res)

		return sendSuccess(res, {
			message: 'Logout successful',
			data: null,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Auth: logout', error)
		return sendFail(res, error)
	}
}

authController.me = async (req, res, next) => {
	try {
		logger('request: auth-me')

		const user = await authService.getMe(req.user._id)

		return sendSuccess(res, {
			message: 'Current user fetched successfully',
			data: user,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Auth: me', error)
		return sendFail(res, error)
	}
}
