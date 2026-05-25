const { logError } = require('./logger')

exports.sendSuccess = (
	res,
	{ message = 'Success', data = null, statusCode = 200 } = {},
) => {
	return res.status(statusCode).json({
		state: 'success',
		message,
		data,
	})
}

exports.sendFail = (res, error, defaultMessage = 'Internal server error') => {
	logError('ERROR:', error)
	const statusCode = error.statusCode || 500

	let message = error.message || defaultMessage

	// Mongo duplicate key error uchun
	if (error.code === 11000) {
		const field = Object.keys(error.keyPattern || {})[0]
		message = field ? `${field} already exists` : 'Duplicate value error'
	}

	return res.status(statusCode).json({
		state: 'fail',
		message,
		data: null,
	})
}
