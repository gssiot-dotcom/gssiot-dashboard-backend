function getPaginationQuery(query) {
	const page = Math.max(Number(query.page) || 1, 1)
	const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
	const skip = (page - 1) * limit

	return {
		page,
		limit,
		skip,
	}
}

function buildPaginationMeta({ page, limit, totalItems }) {
	const totalPages = Math.ceil(totalItems / limit)

	return {
		page,
		limit,
		totalItems,
		totalPages,
		hasNextPage: page < totalPages,
		hasPrevPage: page > 1,
	}
}

module.exports = {
	getPaginationQuery,
	buildPaginationMeta,
}
