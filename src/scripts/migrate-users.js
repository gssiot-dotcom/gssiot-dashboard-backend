// scripts/migrate-users.js

require('dotenv').config()
const { MongoClient } = require('mongodb')

const OLD_DB_URI = process.env.OLD_DB_URI
const NEW_DB_URI = process.env.NEW_DB_URI

const OLD_DB_NAME = process.env.OLD_DB_NAME
const NEW_DB_NAME = process.env.NEW_DB_NAME

const USER_TYPE_MAP = {
	ADMIN: 'admin',
	BOSS: 'manager',
	USER: 'worker',
}

function normalizeEmail(email) {
	return String(email || '')
		.trim()
		.toLowerCase()
}

function normalizePhone(phone) {
	if (phone === null || phone === undefined) return ''
	return String(phone).trim()
}

function mapUserType(oldUserType) {
	return USER_TYPE_MAP[oldUserType]
}

async function migrateUsers() {
	const oldClient = new MongoClient(OLD_DB_URI)
	const newClient = new MongoClient(NEW_DB_URI)

	try {
		await oldClient.connect()
		await newClient.connect()

		const oldDb = oldClient.db()
		const newDb = newClient.db()

		const oldUsersCollection = oldDb.collection('users')
		const newUsersCollection = newDb.collection('users')

		console.log('Connected to old and new DB')

		const oldUsers = await oldUsersCollection.find({}).toArray()

		console.log(`Found ${oldUsers.length} users in old DB`)

		const now = new Date()

		const operations = []

		for (const oldUser of oldUsers) {
			const email = normalizeEmail(oldUser.user_email)
			const userType = mapUserType(oldUser.user_type)

			if (!oldUser.user_name) {
				console.log('Skipped user: missing user_name', oldUser._id)
				continue
			}

			if (!email) {
				console.log('Skipped user: missing user_email', oldUser._id)
				continue
			}

			if (!oldUser.user_password) {
				console.log('Skipped user: missing user_password', oldUser._id)
				continue
			}

			if (!userType) {
				console.log('Skipped user: invalid user_type', {
					_id: oldUser._id,
					user_type: oldUser.user_type,
				})
				continue
			}

			const newUser = {
				_id: oldUser._id,

				name: String(oldUser.user_name).trim(),
				email,
				phone: normalizePhone(oldUser.user_phone),
				password: oldUser.user_password,

				userType,
				isAssigned: true,

				createdAt: oldUser.createdAt || now,
				updatedAt: now,
			}

			operations.push({
				updateOne: {
					filter: { email: newUser.email },
					update: {
						$setOnInsert: newUser,
					},
					upsert: true,
				},
			})
		}

		if (operations.length === 0) {
			console.log('No users to migrate')
			return
		}

		const result = await newUsersCollection.bulkWrite(operations, {
			ordered: false,
		})

		console.log('Migration completed')
		console.log({
			inserted: result.upsertedCount,
			matched: result.matchedCount,
			modified: result.modifiedCount,
		})
	} catch (error) {
		console.error('Migration failed:', error)
	} finally {
		await oldClient.close()
		await newClient.close()
	}
}

migrateUsers()
