  const { createServer } = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 3010
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'

function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Initialize socket data
    socket.data = { userId: null, user: null, rooms: [] }

    socket.on('authenticate', async (token) => {
      try {
        const auth = jwt.verify(token, JWT_SECRET)
        if (auth?.userId) {
          const user = { id: auth.userId, username: auth.username || 'User' }
          socket.data.userId = user.id
          socket.data.user = user
          socket.join(`user:${user.id}`)
          socket.emit('authenticated', { user })
          return
        }
        socket.emit('authentication_error', { message: 'Invalid token format' })
      } catch (error) {
        socket.emit('authentication_error', { message: 'Authentication failed' })
      }
    })

    socket.on('join_group', async (groupId) => {
      try {
        if (!socket.data.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }
        const roomName = `group:${groupId}`
        socket.join(roomName)
        socket.data.rooms.push(roomName)
        socket.emit('joined_group', { groupId })
        socket.to(roomName).emit('user_joined_group', {
          userId: socket.data.userId,
          username: socket.data.user.username
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to join group' })
      }
    })

    socket.on('member_joined_group', async (data) => {
      try {
        const { groupId, memberInfo } = data
        if (!socket.data.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }
        const roomName = `group:${groupId}`
        io.to(roomName).emit('group_member_joined', {
          groupId,
          memberInfo,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to notify group members' })
      }
    })

    socket.on('group_created', async (data) => {
      try {
        const { group } = data || {}
        if (!socket.data.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }
        if (!group || !group.id) {
          return
        }
        io.to(`user:${socket.data.userId}`).emit('group_created', {
          group,
          timestamp: new Date().toISOString()
        })
      } catch (error) {}
    })

    socket.on('leave_group', (groupId) => {
      try {
        const roomName = `group:${groupId}`
        socket.leave(roomName)
        socket.data.rooms = socket.data.rooms.filter((room) => room !== roomName)
        socket.emit('left_group', { groupId })
        socket.to(roomName).emit('user_left_group', {
          userId: socket.data.userId,
          username: socket.data.user.username
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to leave group' })
      }
    })

    socket.on('settings_updated', (payload) => {
      try {
        const userId = socket.data.userId
        if (!userId) return
        io.to(`user:${userId}`).emit('settings_changed', {
          userId,
          settings: payload?.settings || {},
          version: payload?.version
        })
      } catch (error) {}
    })

    socket.on('disconnect', () => {
      socket.data.rooms.forEach((roomName) => {
        socket.to(roomName).emit('user_disconnected', {
          userId: socket.data.userId,
          username: socket.data.user?.username
        })
      })
    })
  })
}

const server = createServer((req, res) => {
  res.statusCode = 200
  res.end('socket-only')
})

const io = new Server(server, {
  path: '/api/socket',
  addTrailingSlash: false,
  transports: ['polling', 'websocket'],
  cors: {
    origin: dev ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'] : false,
    methods: ['GET', 'POST']
  }
})

attachSocketHandlers(io)

server.listen(port, () => {
  console.log(`> Socket-only server on http://${hostname}:${port}`)
})
