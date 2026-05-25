const assetService = require('./asset.service')

async function createUploadUrl(req, res, next) {
	try {
		const { kind, companyId, buildingId, fileName, contentType } = req.body

		if (!kind || !companyId || !fileName || !contentType) {
			return res.status(400).json({
				message: 'kind, companyId, fileName, contentType are required',
			})
		}

		const result = await assetService.createPresignedPutUrl({
			kind,
			companyId,
			buildingId,
			fileName,
			contentType,
		})

		return res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}

async function saveAsset(req, res, next) {
	try {
		const { kind, companyId, buildingId, key } = req.body

		if (!kind || !companyId || !key) {
			return res.status(400).json({
				message: 'kind, companyId, key are required',
			})
		}

		const result = await assetService.saveAssetToDb({
			kind,
			companyId,
			buildingId,
			key,
		})

		return res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}

async function removeAsset(req, res, next) {
	try {
		const { kind, companyId, buildingId, key, deleteFromS3 = false } = req.body

		if (!kind || !companyId || !key) {
			return res.status(400).json({
				message: 'kind, companyId, key are required',
			})
		}

		const result = await assetService.removeAssetFromDb({
			kind,
			companyId,
			buildingId,
			key,
		})

		if (deleteFromS3) {
			await assetService.deleteObjectFromS3(key)
		}

		return res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}

module.exports = {
	createUploadUrl,
	saveAsset,
	removeAsset,
}

module.exports = {
	createUploadUrl,
	saveAsset,
	removeAsset,
}
