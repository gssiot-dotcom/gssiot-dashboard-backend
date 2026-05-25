// const mongoose = require('mongoose')

// const { Schema, model } = mongoose
// const ObjectId = Schema.Types.ObjectId

// const NODE_TYPE = {
// 	ANGLE: 'ANGLE',
// 	DOOR: 'DOOR',
// 	GANGFORM: 'GANGFORM',
// }

// const GATEWAY_TYPES = ['GATEWAY']

// const COMPANY_MEMBER_TYPES = {
// 	OWNER: 'OWNER',
// 	MANAGER: 'MANAGER',
// 	WORKER: 'WORKER',
// 	VIEWER: 'VIEWER',
// }

// const BUILDING_MEMBER_TYPES = {
// 	MANAGER: 'MANAGER',
// 	WORKER: 'WORKER',
// 	VIEWER: 'VIEWER',
// }

// const INVENTORY_STATUS = {
// 	ACTIVE: 'ACTIVE',
// 	RELEASED: 'RELEASED',
// }

// const DEPLOYMENT_STATUS = {
// 	ACTIVE: 'ACTIVE',
// 	REMOVED: 'REMOVED',
// }

// const alarmLevelSchema = new Schema(
// 	{
// 		blue: { type: Number, default: 0 },
// 		green: { type: Number, default: 0 },
// 		yellow: { type: Number, default: 0 },
// 		red: { type: Number, default: 0 },
// 	},
// 	{ _id: false },
// )

// const companySchema = new Schema(
// 	{
// 		company_name: {
// 			type: String,
// 			required: true,
// 			trim: true,
// 		},

// 		company_phone: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		company_addr: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		status: {
// 			type: Boolean,
// 			default: true,
// 		},
// 	},
// 	{ timestamps: true },
// )

// companySchema.index({ company_name: 1 })
// companySchema.index({ status: 1 })

// const companyMemberSchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		user_id: {
// 			type: ObjectId,
// 			ref: 'User',
// 			required: true,
// 		},

// 		member_role: {
// 			type: String,
// 			enum: {
// 				values: Object.values(COMPANY_MEMBER_TYPES),
// 				message: '{VALUE} is not permitted for member_role',
// 			},
// 			required: true,
// 		},

// 		status: {
// 			type: Boolean,
// 			default: true,
// 		},
// 	},
// 	{ timestamps: true },
// )

// companyMemberSchema.index({ company_id: 1, user_id: 1 }, { unique: true })
// companyMemberSchema.index({ user_id: 1, company_id: 1 }, { unique: true })
// companyMemberSchema.index({ user_id: 1, status: 1 })
// companyMemberSchema.index({ company_id: 1, status: 1 })
// companyMemberSchema.index({ company_id: 1, member_role: 1, status: 1 })

// const buildingSchema = new Schema(
// 	{
// 		building_name: {
// 			type: String,
// 			required: true,
// 			trim: true,
// 		},

// 		building_num: {
// 			type: Number,
// 			default: null,
// 		},

// 		building_addr: {
// 			type: String,
// 			required: true,
// 			trim: true,
// 		},

// 		building_plan_img: {
// 			type: String,
// 			default: '',
// 		},

// 		building_status: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		permit_date: {
// 			type: Date,
// 			default: null,
// 		},

// 		expiry_date: {
// 			type: Date,
// 			default: null,
// 		},

// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		angle_alarm_level: {
// 			type: alarmLevelSchema,
// 			default: () => ({}),
// 		},

// 		gangform_alarm_level: {
// 			type: alarmLevelSchema,
// 			default: () => ({}),
// 		},
// 	},
// 	{ timestamps: true },
// )

// buildingSchema.index({ company_id: 1, building_status: 1 })
// buildingSchema.index({ company_id: 1, building_name: 1 })
// buildingSchema.index({ company_id: 1, building_num: 1 })

// const buildingMemberSchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		building_id: {
// 			type: ObjectId,
// 			ref: 'Building',
// 			required: true,
// 		},

// 		user_id: {
// 			type: ObjectId,
// 			ref: 'User',
// 			required: true,
// 		},

// 		member_role: {
// 			type: String,
// 			enum: {
// 				values: Object.values(BUILDING_MEMBER_TYPES),
// 				message: '{VALUE} is not permitted for building member_role',
// 			},
// 			default: BUILDING_MEMBER_TYPES.WORKER,
// 		},

// 		status: {
// 			type: Boolean,
// 			default: true,
// 		},
// 	},
// 	{ timestamps: true },
// )

// buildingMemberSchema.index(
// 	{ company_id: 1, building_id: 1, user_id: 1 },
// 	{ unique: true },
// )
// buildingMemberSchema.index({ user_id: 1, status: 1 })
// buildingMemberSchema.index({ building_id: 1, status: 1 })
// buildingMemberSchema.index({ company_id: 1, user_id: 1, status: 1 })

// const gatewaySchema = new Schema(
// 	{
// 		serial_number: {
// 			type: String,
// 			required: true,
// 			unique: true,
// 			trim: true,
// 		},

// 		gateway_status: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		gateway_type: {
// 			type: String,
// 			required: true,
// 			enum: {
// 				values: GATEWAY_TYPES,
// 				message: '{VALUE} is not permitted to gateway type',
// 			},
// 			default: 'GATEWAY',
// 		},

// 		gateway_alive: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		lastSeen: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// gatewaySchema.index({ serial_number: 1 }, { unique: true })
// gatewaySchema.index({ gateway_status: 1 })
// gatewaySchema.index({ gateway_alive: 1, lastSeen: -1 })

// const nodeSchema = new Schema(
// 	{
// 		node_number: {
// 			type: Number,
// 			required: true,
// 		},

// 		node_type: {
// 			type: String,
// 			required: true,
// 			enum: Object.values(NODE_TYPE),
// 		},

// 		door_state: {
// 			type: Number,
// 			default: 0,
// 		},

// 		battery_state: {
// 			type: Number,
// 			default: 0,
// 		},

// 		node_status: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		angle_x: {
// 			type: Number,
// 			default: 0,
// 		},

// 		angle_y: {
// 			type: Number,
// 			default: 0,
// 		},

// 		calibrated_x: {
// 			type: Number,
// 			default: 0,
// 		},

// 		calibrated_y: {
// 			type: Number,
// 			default: 0,
// 		},

// 		save_status: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		save_status_lastChange: {
// 			type: Date,
// 			default: Date.now,
// 		},

// 		node_alive: {
// 			type: Boolean,
// 			default: true,
// 		},

// 		lastSeen: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// nodeSchema.index({ node_number: 1 }, { unique: true })
// nodeSchema.index({ node_type: 1, node_status: 1 })
// nodeSchema.index({ node_alive: 1, lastSeen: -1 })

// const companyGatewaySchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		gateway_id: {
// 			type: ObjectId,
// 			ref: 'Gateway',
// 			required: true,
// 		},

// 		status: {
// 			type: String,
// 			enum: Object.values(INVENTORY_STATUS),
// 			default: INVENTORY_STATUS.ACTIVE,
// 		},

// 		assigned_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		released_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		assigned_at: {
// 			type: Date,
// 			default: Date.now,
// 		},

// 		released_at: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// companyGatewaySchema.index({ company_id: 1, status: 1 })
// companyGatewaySchema.index({ gateway_id: 1, status: 1 })
// companyGatewaySchema.index(
// 	{ gateway_id: 1, status: 1 },
// 	{
// 		unique: true,
// 		partialFilterExpression: { status: INVENTORY_STATUS.ACTIVE },
// 	},
// )

// const companyNodeSchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		node_id: {
// 			type: ObjectId,
// 			ref: 'Node',
// 			required: true,
// 		},

// 		status: {
// 			type: String,
// 			enum: Object.values(INVENTORY_STATUS),
// 			default: INVENTORY_STATUS.ACTIVE,
// 		},

// 		assigned_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		released_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		assigned_at: {
// 			type: Date,
// 			default: Date.now,
// 		},

// 		released_at: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// companyNodeSchema.index({ company_id: 1, status: 1 })
// companyNodeSchema.index({ node_id: 1, status: 1 })
// companyNodeSchema.index(
// 	{ node_id: 1, status: 1 },
// 	{
// 		unique: true,
// 		partialFilterExpression: { status: INVENTORY_STATUS.ACTIVE },
// 	},
// )

// const gatewayDeploymentSchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		building_id: {
// 			type: ObjectId,
// 			ref: 'Building',
// 			required: true,
// 		},

// 		gateway_id: {
// 			type: ObjectId,
// 			ref: 'Gateway',
// 			required: true,
// 		},

// 		zone_name: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		floor: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		location_description: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		status: {
// 			type: String,
// 			enum: Object.values(DEPLOYMENT_STATUS),
// 			default: DEPLOYMENT_STATUS.ACTIVE,
// 		},

// 		installed_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		removed_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		installed_at: {
// 			type: Date,
// 			default: Date.now,
// 		},

// 		removed_at: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// gatewayDeploymentSchema.index({ company_id: 1, building_id: 1, status: 1 })
// gatewayDeploymentSchema.index({ building_id: 1, status: 1 })
// gatewayDeploymentSchema.index({ gateway_id: 1, status: 1 })
// gatewayDeploymentSchema.index(
// 	{ gateway_id: 1, status: 1 },
// 	{
// 		unique: true,
// 		partialFilterExpression: { status: DEPLOYMENT_STATUS.ACTIVE },
// 	},
// )

// const nodeDeploymentSchema = new Schema(
// 	{
// 		company_id: {
// 			type: ObjectId,
// 			ref: 'Company',
// 			required: true,
// 		},

// 		building_id: {
// 			type: ObjectId,
// 			ref: 'Building',
// 			required: true,
// 		},

// 		gateway_id: {
// 			type: ObjectId,
// 			ref: 'Gateway',
// 			required: true,
// 		},

// 		node_id: {
// 			type: ObjectId,
// 			ref: 'Node',
// 			required: true,
// 		},

// 		position: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		node_position_img: {
// 			type: String,
// 			default: '',
// 		},

// 		floor: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		location_description: {
// 			type: String,
// 			default: '',
// 			trim: true,
// 		},

// 		status: {
// 			type: String,
// 			enum: Object.values(DEPLOYMENT_STATUS),
// 			default: DEPLOYMENT_STATUS.ACTIVE,
// 		},

// 		installed_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		removed_by: {
// 			type: ObjectId,
// 			ref: 'User',
// 			default: null,
// 		},

// 		installed_at: {
// 			type: Date,
// 			default: Date.now,
// 		},

// 		removed_at: {
// 			type: Date,
// 			default: null,
// 		},
// 	},
// 	{ timestamps: true },
// )

// nodeDeploymentSchema.index({ company_id: 1, building_id: 1, status: 1 })
// nodeDeploymentSchema.index({ building_id: 1, gateway_id: 1, status: 1 })
// nodeDeploymentSchema.index({ gateway_id: 1, status: 1 })
// nodeDeploymentSchema.index({ node_id: 1, status: 1 })
// nodeDeploymentSchema.index(
// 	{ node_id: 1, status: 1 },
// 	{
// 		unique: true,
// 		partialFilterExpression: { status: DEPLOYMENT_STATUS.ACTIVE },
// 	},
// )

// const Company = model('Company', companySchema)
// const CompanyMember = model('CompanyMember', companyMemberSchema)
// const Building = model('Building', buildingSchema)
// const BuildingMember = model('BuildingMember', buildingMemberSchema)
// const Gateway = model('Gateway', gatewaySchema)
// const Node = model('Node', nodeSchema)
// const CompanyGateway = model('CompanyGateway', companyGatewaySchema)
// const CompanyNode = model('CompanyNode', companyNodeSchema)
// const GatewayDeployment = model('GatewayDeployment', gatewayDeploymentSchema)
// const NodeDeployment = model('NodeDeployment', nodeDeploymentSchema)

// module.exports = {
// 	Company,
// 	CompanyMember,
// 	Building,
// 	BuildingMember,
// 	Gateway,
// 	Node,
// 	CompanyGateway,
// 	CompanyNode,
// 	GatewayDeployment,
// 	NodeDeployment,
// 	NODE_TYPE,
// 	GATEWAY_TYPES,
// 	COMPANY_MEMBER_TYPES,
// 	BUILDING_MEMBER_TYPES,
// 	INVENTORY_STATUS,
// 	DEPLOYMENT_STATUS,
// }
