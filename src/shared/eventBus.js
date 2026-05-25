const EventEmitter = require('events')

const eventBus = new EventEmitter()
// Ko‘p listener bo‘lsa warning chiqmasin:
eventBus.setMaxListeners(50)

module.exports = { eventBus }
