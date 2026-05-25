const jwt = require('jsonwebtoken')
const { UserSchema } = require('../modules/users/user.model')

const unauthorized = (res, message = 'Unauthorized') => {
	return res.status(401).json({
		success: false,
		message,
	})
}

exports.isAuth = async (req, res, next) => {
	try {
		const token = req.cookies?.access_token

		if (!token) {
			return unauthorized(res, 'Unauthorized')
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)

		const user = await UserSchema.findById(decoded.id).select('-password')
		if (!user) {
			return unauthorized(res, 'User not found')
		}

		req.user = user
		next()
	} catch (error) {
		return unauthorized(res, 'Invalid or expired token')
	}
}
