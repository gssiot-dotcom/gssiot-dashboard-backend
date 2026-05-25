exports.USER_TYPES = ['admin', 'manager', 'worker', 'user']
exports.SIGNUP_USER_TYPES = ['manager', 'worker', 'user']
exports.COMPANY_MEMBER_TYPES = { manager: 'manager', worker: 'worker' }

exports.GATEWAY_TYPES = {
	NODES: 'nodes_gateway',
	SECURITY_OFFICE: 'security_office_gateway',
}

exports.NODE_TYPE = {
	DOOR: 'door_node',
	ANGLE: 'angle_node',
	GANGFORM: 'gangform_node',
}
;((exports.NODE_STATUS = 'safe' | 'caution'), 'warning' | 'danger' | 'offline')

exports.ALARM_NODE_TYPES = {
	ANGLE: 'angle_node',
	GANGFORM: 'gangform_node',
}

// It is for company users
exports.NODE_UPDATE_ALLOWED_FIELDS = [
	'companyId',
	'buildingId',
	'gatewayId',
	'installedLocation',
	'installLocationImg',
	'saveStatus',
]

// =================== Dashboards endpoint types ===================
exports.MEMBER_STATUS = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
}

exports.COMPANY_STATUS = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
}

exports.BUILDING_STATUS = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
}
