exports.isAdmin = (req, res, next) => {
	try {
		if (!req.user) {
			return res.status(401).json({
				state: 'error',
				message: 'Unauthorized',
				data: null,
			})
		}

		if (req.user.userType !== 'admin' && req.user.userType !== 'SUPER_ADMIN') {
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
