const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logger, logError } = require('../../lib/logger')

const { getPaginationQuery } = require('../../utils/pagination')
const AdminOrganizationService = require('./admin.org.service')

const adminOrganizationService = new AdminOrganizationService()

let adminOrganizationController = module.exports

// ========= Admin Organization controllers ==========
adminOrganizationController.getCompanies = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminOrganizationService.getCompanies({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Companies fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch companies',
			error.statusCode || error.status || 500,
		)
	}
}

adminOrganizationController.getBuildings = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminOrganizationService.getBuildings({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch buildings',
			error.statusCode || error.status || 500,
		)
	}
}

adminOrganizationController.getUsers = async (req, res) => {
	try {
		const { page, limit, skip } = getPaginationQuery(req.query)

		const data = await adminOrganizationService.getUsers({
			page,
			limit,
			skip,
			search: req.query.search || '',
		})

		return sendSuccess(res, {
			message: 'Users fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch users',
			error.statusCode || error.status || 500,
		)
	}
}

adminOrganizationController.getOrganizationCompanyBuildings = async (
	req,
	res,
) => {
	try {
		const data = await adminOrganizationService.getCompanyBuildings(
			req.params.companyId,
		)

		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch company buildings',
			error.statusCode || error.status || 500,
		)
	}
}

adminOrganizationController.getOrganizationBuildingGateways = async (
	req,
	res,
) => {
	try {
		const data = await adminOrganizationService.getBuildingGateways(
			req.params.buildingId,
		)

		return sendSuccess(res, {
			message: 'Building gateways fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch building gateways',
			error.statusCode || error.status || 500,
		)
	}
}

adminOrganizationController.getOrganizationUserCompanies = async (req, res) => {
	try {
		const data = await adminOrganizationService.getUserCompanies(
			req.params.userId,
		)

		return sendSuccess(res, {
			message: 'User companies fetched successfully',
			data,
			statusCode: 200,
		})
	} catch (error) {
		logError(error)

		return sendFail(
			res,
			error.message || 'Failed to fetch user companies',
			error.statusCode || error.status || 500,
		)
	}
}
