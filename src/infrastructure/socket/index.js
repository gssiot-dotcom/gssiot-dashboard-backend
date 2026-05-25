const { logger } = require('../../lib/logger')
const { eventBus } = require('../../shared/eventBus')

let ioInitialized = false

function getRoomName(buildingId, nodeType) {
	return `building:${buildingId}:type:${nodeType}`
}

function initSocket(serverIo) {
	if (ioInitialized) return
	ioInitialized = true

	const io = serverIo

	// realtime events
	eventBus.on('rt.node', payload => {
		if (!payload?.buildingId) return
		const room = getRoomName(payload.buildingId, 'node')
		io.to(room).emit('realtime-data', payload)
	})

	eventBus.on('rt.angle', payload => {
		if (!payload?.buildingId) return
		const room = getRoomName(payload.buildingId, 'angle')
		io.to(room).emit('realtime-data', payload)
	})

	eventBus.on('rt.vertical', payload => {
		if (!payload?.buildingId) return
		const room = getRoomName(payload.buildingId, 'vertical')
		io.to(room).emit('realtime-data', payload)
	})

	io.on('connection', socket => {
		console.log(`New SOCKET user connected: ${socket.id}`)

		socket.on('join_realtime', ({ buildingId, nodeType }) => {
			if (!buildingId || !nodeType) return

			const room = getRoomName(buildingId, nodeType)

			// agar oldin boshqa roomda bo‘lsa, chiqib ketadi
			if (socket.data.currentRoom) {
				socket.leave(socket.data.currentRoom)
			}

			socket.join(room)
			socket.data.currentRoom = room

			console.log(`Socket ${socket.id} joined ${room}`)
		})

		socket.on('leave_realtime', () => {
			if (socket.data.currentRoom) {
				socket.leave(socket.data.currentRoom)
				console.log(`Socket ${socket.id} left ${socket.data.currentRoom}`)
				socket.data.currentRoom = null
			}
		})

		socket.on('disconnect', () => {
			console.log(`SOCKET user disconnected: ${socket.id}`)
		})
	})
}

module.exports = { initSocket }
