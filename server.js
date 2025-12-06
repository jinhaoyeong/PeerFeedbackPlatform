const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = Number(process.env.PORT) || 3004
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

async function startWithNext() {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
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
    const db = process.env.DATABASE_URL || ''
    const proto = db.split(':')[0]
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Database URL protocol: ${proto || 'unset'}`)
  })
}

function startSocketOnly() {
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
}

function attachSocketHandlers(io) {
  // Set up socket.io handlers
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    // Initialize socket data
    socket.data = {
      userId: null,
      user: null,
      rooms: []
    }

    // Handle authentication
    socket.on('authenticate', async (token) => {
      try {
        console.log(`Authentication attempt from ${socket.id}`)
        console.log('Token received:', token ? 'token exists' : 'no token')
        console.log('JWT_SECRET from env:', process.env.JWT_SECRET ? 'JWT_SECRET exists' : 'JWT_SECRET missing')

        const auth = jwt.verify(token, JWT_SECRET)
        console.log('JWT verification result:', auth)

        if (auth?.userId) {
          // For now, create a basic user object
          // In production, you'd fetch from database
          const user = {
            id: auth.userId,
            username: auth.username || 'User'
          }

          socket.data.userId = user.id
          socket.data.user = user
          socket.join(`user:${user.id}`)

          socket.emit('authenticated', { user })
          console.log(`User authenticated: ${user.username} (${socket.id})`)
          return
        }
        console.log('JWT verification succeeded but no userId found')
        socket.emit('authentication_error', { message: 'Invalid token format' })
      } catch (error) {
        console.error('Socket authentication error details:', {
          message: error.message,
          name: error.name,
          expiredAt: error.expiredAt,
          token: token?.substring(0, 20) + '...'
        })
        const user = {
          id: `guest:${socket.id}`,
          username: 'Guest'
        }
        socket.data.userId = user.id
        socket.data.user = user
        socket.join(`user:${user.id}`)
        socket.emit('authenticated', { user })
      }
    })

    // Handle joining group rooms
    socket.on('join_group', async (groupId) => {
      try {
        if (!socket.data.userId) {
          socket.data.userId = `guest:${socket.id}`
          socket.data.user = { id: socket.data.userId, username: 'Guest' }
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
        console.error('Join group error:', error)
        socket.emit('error', { message: 'Failed to join group' })
      }
    })

    // Handle notifying group when a new member joins
    socket.on('member_joined_group', async (data) => {
      try {
        const { groupId, memberInfo } = data
        if (!socket.data.userId) {
          socket.data.userId = `guest:${socket.id}`
          socket.data.user = { id: socket.data.userId, username: 'Guest' }
        }
        const roomName = `group:${groupId}`
        io.to(roomName).emit('group_member_joined', {
          groupId,
          memberInfo,
          timestamp: new Date().toISOString()
        })

        console.log(`Broadcasted member join event to group ${groupId}:`, memberInfo)
      } catch (error) {
        console.error('Member joined group notification error:', error)
        socket.emit('error', { message: 'Failed to notify group members' })
      }
    })

    // Handle group creation - notify creator's user room so their dashboard updates
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
        // Notify creator's room
        io.to(`user:${socket.data.userId}`).emit('group_created', {
          group,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        console.error('Group created notification error:', error)
      }
    })

    // Handle group deletion
    socket.on('group_deleted', async (data) => {
      try {
        const { groupId } = data || {}
        if (!socket.data.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }
        if (!groupId) return
        const payload = { groupId, timestamp: new Date().toISOString() }
        io.to(`group:${groupId}`).emit('group_deleted', payload)
        io.to(`user:${socket.data.userId}`).emit('group_deleted', payload)
      } catch (error) {
        console.error('Group deleted notification error:', error)
      }
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
        console.error('Leave group error:', error)
        socket.emit('error', { message: 'Failed to leave group' })
      }
    })

    socket.on('join_session', async (sessionId) => {
      try {
        if (!socket.data.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }

        const roomName = `session:${sessionId}`
        socket.join(roomName)
        socket.data.rooms.push(roomName)

        socket.emit('joined_session', { sessionId })

      } catch (error) {
        console.error('Join session error:', error)
        socket.emit('error', { message: 'Failed to join session' })
      }
    })

    // Settings synchronization: broadcast updates to this user's room
    socket.on('settings_updated', (payload) => {
      try {
        const userId = socket.data.userId
        if (!userId) return
        io.to(`user:${userId}`).emit('settings_changed', {
          userId,
          settings: payload?.settings || {},
          version: payload?.version
        })
      } catch (error) {
        console.error('Settings update broadcast error:', error)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id} (${reason})`)
      socket.data.rooms.forEach((roomName) => {
        socket.to(roomName).emit('user_disconnected', {
          userId: socket.data.userId,
          username: socket.data.user?.username
        })
      })
    })

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error)
    })
  })
}

(async () => {
  try {
    await app.prepare()
    await startWithNext()
  } catch (e) {
    console.error('Next prepare failed, starting socket-only server:', e?.message)
    startSocketOnly()
  }
})()
