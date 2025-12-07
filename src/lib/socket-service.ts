import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { AuthService } from './auth-service'
import { prisma } from './prisma'

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: any
}

export interface SocketData {
  userId?: string
  user?: any
  rooms: string[]
}

export const config = {
  api: {
    bodyParser: false
  }
}

class SocketService {
  private io: ServerIO | null = null
  private userSettingsCache: Map<string, { allowMessaging?: boolean }> = new Map()

  init(res: NextApiResponseServerIO) {
    if (!this.io) {
      const httpServer: NetServer = res.socket.server as any
      this.io = new ServerIO(httpServer, {
        path: '/api/socket',
        addTrailingSlash: false,
        transports: ['polling', 'websocket'],
        cors: {
          origin: process.env.NODE_ENV === 'production'
            ? false
            : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
          methods: ['GET', 'POST']
        }
      })

      this.setupEventHandlers()
    }

    return this.io
  }

  private setupEventHandlers() {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`)

      // Initialize socket data
      socket.data = {
        userId: undefined,
        user: null,
        rooms: []
      } as unknown as SocketData

      // Handle authentication
      socket.on('authenticate', async (token: string) => {
        try {
          const auth = AuthService.verifyToken(token)
          if (auth?.userId) {
            const user = await AuthService.getUserById(auth.userId)
            if (user) {
              socket.data.userId = user.id
              socket.data.user = user
              socket.join(`user:${user.id}`)

              // Join user's group rooms
              await this.joinUserGroups(socket, user.id)

              socket.emit('authenticated', { user })
              try {
                const latest = await prisma.auditLog.findFirst({
                  where: { userId: user.id, action: 'USER_SETTINGS' },
                  orderBy: { occurredAt: 'desc' }
                })
                let stored: any = null
                try { stored = latest?.details ? JSON.parse(latest.details as any) : null } catch {}
                const allowMessaging = stored?.allowMessaging ?? true
                this.userSettingsCache.set(user.id, { allowMessaging })
              } catch {}
            }
          }
          socket.emit('authentication_error', { message: 'Invalid token' })
        } catch (error) {
          console.error('Socket authentication error:', error)
          socket.emit('authentication_error', { message: 'Authentication failed' })
        }
      })

      // Update cached settings live when client saves
      socket.on('settings_updated', (payload: any) => {
        try {
          const userId = socket.data.userId
          if (!userId) return
          const next = payload?.settings || {}
          if (typeof next.allowMessaging !== 'undefined') {
            const prev = this.userSettingsCache.get(userId) || {}
            this.userSettingsCache.set(userId, { ...prev, allowMessaging: !!next.allowMessaging })
          }
          // Rebroadcast to user room for client-side synchronization
          this.io?.to(`user:${userId}`).emit('settings_changed', { userId, settings: next, version: payload?.version })
        } catch {}
      })

      // Direct messaging between users
      socket.on('direct_message', async (data: { toUserId: string; content: string }) => {
        try {
          const fromUserId = socket.data.userId
          if (!fromUserId) return
          const toUserId = String(data?.toUserId || '')
          const content = String(data?.content || '').trim()
          if (!toUserId || !content) return

          const recipientSettings = this.userSettingsCache.get(toUserId) || {}
          const allowMessaging = typeof recipientSettings.allowMessaging === 'undefined' ? true : !!recipientSettings.allowMessaging
          if (!allowMessaging) {
            socket.emit('direct_message_error', { code: 'blocked', message: 'Recipient has disabled messaging' })
            return
          }

          try {
            await (prisma as any).directMessage.create({
              data: { senderId: fromUserId, recipientId: toUserId, content }
            })
          } catch {}

          this.io?.to(`user:${toUserId}`).emit('direct_message', {
            fromUserId,
            content,
            timestamp: new Date().toISOString()
          })

          socket.emit('direct_message_ack', {
            toUserId,
            content,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error('Direct message error:', error)
          socket.emit('direct_message_error', { code: 'server_error', message: 'Failed to send message' })
        }
      })

      // Handle joining group rooms
      socket.on('join_group', async (groupId: string) => {
        try {
          if (!socket.data.userId) {
            socket.emit('error', { message: 'Not authenticated' })
            return
          }

          // Verify user is member of the group
          const membership = await prisma.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId,
                userId: socket.data.userId
              }
            }
          })

          if (!membership) {
            socket.emit('error', { message: 'Not a member of this group' })
            return
          }

          const roomName = `group:${groupId}`
          socket.join(roomName)
          socket.data.rooms.push(roomName)

          socket.emit('joined_group', { groupId })

          // Notify other group members
          socket.to(roomName).emit('user_joined_group', {
            userId: socket.data.userId,
            username: socket.data.user.username
          })

        } catch (error) {
          console.error('Join group error:', error)
          socket.emit('error', { message: 'Failed to join group' })
        }
      })

      // Handle leaving group rooms
      socket.on('leave_group', (groupId: string) => {
        try {
          const roomName = `group:${groupId}`
          socket.leave(roomName)
          socket.data.rooms = socket.data.rooms.filter((room: string) => room !== roomName)

          socket.emit('left_group', { groupId })

          // Notify other group members
          socket.to(roomName).emit('user_left_group', {
            userId: socket.data.userId,
            username: socket.data.user.username
          })

        } catch (error) {
          console.error('Leave group error:', error)
          socket.emit('error', { message: 'Failed to leave group' })
        }
      })

      // Handle joining feedback session rooms
      socket.on('join_session', async (sessionId: string) => {
        try {
          if (!socket.data.userId) {
            socket.emit('error', { message: 'Not authenticated' })
            return
          }

          // Verify user has access to the session
          const session = await prisma.feedbackSession.findUnique({
            where: { id: sessionId },
            include: { group: true }
          })

          if (!session) {
            socket.emit('error', { message: 'Session not found' })
            return
          }

          const membership = await prisma.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: session.groupId,
                userId: socket.data.userId
              }
            }
          })

          if (!membership) {
            socket.emit('error', { message: 'Access denied' })
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

      // Handle feedback submission notifications
      socket.on('feedback_submitted', async (data: { sessionId: string; targetUserId: string }) => {
        try {
          if (!socket.data.userId) {
            return
          }

          // Notify target user
          socket.to(`user:${data.targetUserId}`).emit('new_feedback', {
            sessionId: data.sessionId,
            submitterUsername: socket.data.user.username,
            timestamp: new Date().toISOString()
          })

          // Notify session room (for real-time updates)
          socket.to(`session:${data.sessionId}`).emit('session_update', {
            type: 'feedback_submitted',
            sessionId: data.sessionId,
            timestamp: new Date().toISOString()
          })

        } catch (error) {
          console.error('Feedback notification error:', error)
        }
      })

      // Handle session status changes
      socket.on('session_status_change', async (data: { sessionId: string; status: string }) => {
        try {
          if (!socket.data.userId) {
            return
          }

          // Verify user can change session status
          const session = await prisma.feedbackSession.findUnique({
            where: { id: data.sessionId },
            include: { group: true }
          })

          if (!session) {
            return
          }

          const membership = await prisma.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: session.groupId,
                userId: socket.data.userId
              }
            }
          })

          if (!membership || membership.role !== 'ADMIN') {
            return
          }

          // Notify all session participants
          socket.to(`session:${data.sessionId}`).emit('session_status_changed', {
            sessionId: data.sessionId,
            status: data.status,
            changedBy: socket.data.user.username,
            timestamp: new Date().toISOString()
          })

        } catch (error) {
          console.error('Session status notification error:', error)
        }
      })

          

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id} (${reason})`)

        // Notify rooms that user left
        socket.data.rooms.forEach((roomName: string) => {
          socket.to(roomName).emit('user_disconnected', {
            userId: socket.data.userId,
            username: socket.data.user?.username
          })
        })
      })

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error)
      })
    })
  }

  private async joinUserGroups(socket: any, userId: string) {
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true }
      })

      memberships.forEach((membership: any) => {
        const roomName = `group:${membership.groupId}`
        socket.join(roomName)
        socket.data.rooms.push(roomName)
      })
    } catch (error) {
      console.error('Error joining user groups:', error)
    }
  }

  // Public methods for external use
  notifyUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data)
    }
  }

  notifyGroup(groupId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`group:${groupId}`).emit(event, data)
    }
  }

  notifySession(sessionId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`session:${sessionId}`).emit(event, data)
    }
  }

  getIO() {
    return this.io
  }
}

export const socketService = new SocketService()
