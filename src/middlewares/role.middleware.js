exports.allowRoles = (...roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ message: 'Unauthorized' })
		}

		if (!roles.includes(req.user.user_type)) {
			return res.status(403).json({ message: 'Forbidden' })
		}

		next()
	}
}

exports.selfOrAdmin = (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				state: 'error',
				message: 'Unauthorized',
				data: null,
			})
		}

		const isAdmin =
			req.user.user_type === 'ADMIN' || req.user.user_type === 'SUPER_ADMIN'

		const isSelf = String(req.user._id) === String(req.params.id)

		if (!isAdmin && !isSelf) {
			return res.status(403).json({
				state: 'error',
				message: 'You can only update your own profile',
				data: null,
			})
		}

		next()
	} catch (error) {
		return res.status(500).json({
			state: 'error',
			message: 'Server error',
			data: null,
		})
	}
}

exports.isManager = (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				state: 'error',
				message: 'Unauthorized',
				data: null,
			})
		}

		if (req.user.userType !== 'manager') {
			return res.status(403).json({
				state: 'error',
				message: 'Access denied',
				data: null,
			})
		}

		next()
	} catch (error) {
		return res.status(500).json({
			state: 'error',
			message: 'Server error',
			data: null,
		})
	}
}

exports.isWorker = (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				state: 'error',
				message: 'Unauthorized',
				data: null,
			})
		}

		if (req.user.userType !== 'worker') {
			return res.status(403).json({
				state: 'error',
				message: 'Access denied',
				data: null,
			})
		}

		next()
	} catch (error) {
		return res.status(500).json({
			state: 'error',
			message: 'Server error',
			data: null,
		})
	}
}
