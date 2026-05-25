const CompanyService = require('./company.service')
const { sendSuccess, sendFail } = require('../../lib/http.response')
const { logError, logger } = require('../../lib/logger')

const companyService = new CompanyService()

let companyController = module.exports

companyController.createCompany = async (req, res, next) => {
	try {
		logger('request: company-create')

		const result = await companyService.createCompany(req.body)

		return sendSuccess(res, {
			message: 'Company created successfully',
			data: result,
			statusCode: 201,
		})
	} catch (error) {
		logError('ERROR: contr.Company: createCompany', error)
		return sendFail(res, error)
	}
}

companyController.companies = async (req, res, next) => {
	try {
		logger('request: company-companies')

		const result = await companyService.getCompanies(req.query)

		return sendSuccess(res, {
			message: 'Companies fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: companies', error)
		return sendFail(res, error)
	}
}

companyController.activeCompanies = async (req, res, next) => {
	try {
		logger('request: company-activeCompanies')

		const result = await companyService.getActiveCompanies()

		return sendSuccess(res, {
			message: 'Active companies fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: activeCompanies', error)
		return sendFail(res, error)
	}
}

companyController.detail = async (req, res, next) => {
	try {
		logger('request: company-detail')

		const result = await companyService.getCompanyDetail(req.params.id)

		return sendSuccess(res, {
			message: 'Company detail fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: detail', error)
		return sendFail(res, error)
	}
}

companyController.buildings = async (req, res, next) => {
	try {
		logger('request: company-buildings')

		const result = await companyService.getCompanyBuildings(req.params.id)

		return sendSuccess(res, {
			message: 'Company buildings fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: buildings', error)
		return sendFail(res, error)
	}
}

companyController.updateStatus = async (req, res, next) => {
	try {
		logger('request: company-updateStatus')

		const result = await companyService.updateCompanyStatus(req.params.id)

		return sendSuccess(res, {
			message: 'Company status updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: updateStatus', error)
		return sendFail(res, error)
	}
}

companyController.update = async (req, res, next) => {
	try {
		logger('request: company-update')

		const result = await companyService.updateCompany(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Company updated successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: update', error)
		return sendFail(res, error)
	}
}

companyController.members = async (req, res, next) => {
	try {
		logger('request: company-members')

		const result = await companyService.getCompanyMembers(req.params.id)

		return sendSuccess(res, {
			message: 'Company members fetched successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: members', error)
		return sendFail(res, error)
	}
}

companyController.assignManagers = async (req, res, next) => {
	try {
		logger('request: company-assignManagers')

		const result = await companyService.assignManagers(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Manager added to company successfully',
			data: result,
			statusCode: 201,
		})
	} catch (error) {
		logError('ERROR: contr.Company: assignManagers', error)
		return sendFail(res, error)
	}
}

companyController.assignWorkersToBuilding = async (req, res, next) => {
	try {
		logger('request: company-assignWorkersToBuilding')
		const { id: companyId, buildingId } = req.params

		const result = await companyService.assignWorkersToBuilding(
			companyId,
			buildingId,
			req.body,
		)

		return sendSuccess(res, {
			message: 'Workers assigned to building successfully',
			data: result,
			statusCode: 201,
		})
	} catch (error) {
		logError('ERROR: contr.Company: assignWorkersToBuilding', error)
		return sendFail(res, error)
	}
}

companyController.assignBuildings = async (req, res, next) => {
	try {
		logger('request: company-assignBuildings')

		const result = await companyService.assignBuildings(req.params.id, req.body)

		return sendSuccess(res, {
			message: 'Buildings assigned to company successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: assignBuildings', error)
		return sendFail(res, error)
	}
}

companyController.unassignBuildings = async (req, res, next) => {
	try {
		logger('request: company-unassignBuildings')

		const result = await companyService.unassignBuildings(
			req.params.id,
			req.body,
		)

		return sendSuccess(res, {
			message: 'Buildings unassigned from company successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: unassignBuildings', error)
		return sendFail(res, error)
	}
}

companyController.deleteCompany = async (req, res, next) => {
	try {
		logger('request: company-deleteCompany')

		const result = await companyService.deleteCompany(req.params.id)

		return sendSuccess(res, {
			message: 'Company deleted successfully',
			data: result,
			statusCode: 200,
		})
	} catch (error) {
		logError('ERROR: contr.Company: deleteCompany', error)
		return sendFail(res, error)
	}
}
