const { sendFail } = require('../../lib/http.response')
const UserService = require('./user.service')
const userService = new UserService()

let userController = module.exports

userController.getUsers = async (req, res) => {
	try {
		const data = await userService.getUsers(req.query)

		return res.status(200).json({
			state: 'success',
			message: 'Users fetched successfully',
			data,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

userController.getUserById = async (req, res) => {
	try {
		const data = await userService.getUserById(req.params.id)

		return sendSuccess(res, {
			message: 'User fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

userController.createUser = async (req, res) => {
	try {
		const data = await userService.createUser(req.body)

		return sendSuccess(res, {
			message: 'User created successfully',
			data,
			statusCode: 201,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

userController.updateUser = async (req, res) => {
	try {
		const data = await userService.updateUser(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'User updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

userController.deleteUser = async (req, res) => {
	try {
		const data = await userService.deleteUser(req.params.id)

		return sendSuccess(res, {
			message: 'User deleted successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}

userController.changeUserStatus = async (req, res) => {
	try {
		const data = await userService.changeUserStatus(
			req.params.id,
			req.body.status,
		)

		return sendSuccess(res, {
			message: 'User status updated successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		sendFail(res, error)
	}
}
