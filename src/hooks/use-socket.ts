'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/components/auth-provider'

  interface SocketHookReturn {
    socket: Socket | null
    isConnected: boolean
    error: string | null
    joinGroup: (groupId: string) => void
    leaveGroup: (groupId: string) => void
    joinSession: (sessionId: string) => void
    notifyFeedbackSubmitted: (sessionId: string, targetUserId: string) => void
    notifySessionStatusChange: (sessionId: string, status: string) => void
    startTyping: (sessionId: string, targetUserId?: string) => void
    stopTyping: (sessionId: string, targetUserId?: string) => void
    notifyMemberJoinedGroup: (groupId: string, memberInfo: any) => void
    onGroupMemberJoined: (callback: (data: { groupId: string, memberInfo: any, timestamp: string }) => void) => void
    notifyMemberLeftGroup: (groupId: string, memberInfo: any) => void
    onGroupMemberLeft: (callback: (data: { groupId: string, memberInfo: any, timestamp: string }) => void) => void
    notifyGroupCreated: (groupData: any) => void
    onGroupCreated: (callback: (data: { group: any, timestamp: string }) => void) => void
    notifyGroupDeleted: (groupId: string) => void
    onGroupDeleted: (callback: (data: { groupId: string, timestamp: string }) => void) => void
    sendDirectMessage: (toUserId: string, content: string) => void
    onDirectMessage: (callback: (data: { fromUserId: string, content: string, timestamp: string }) => void) => void
    onDirectMessageAck: (callback: (data: { toUserId: string, content: string, timestamp: string }) => void) => void
    onDirectMessageError: (callback: (data: { code: string, message?: string }) => void) => void
  }

export function useSocket(): SocketHookReturn {
  const { user, token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!user || !token) {
      console.log('No user or token available, skipping Socket.IO connection')
      return
    }

    // Prevent multiple connections by checking if we already have a valid connection
    if (socketRef.current?.connected) {
      console.log('Socket already connected, skipping new connection')
      return
    }

    // Clean up any existing but disconnected socket
    if (socketRef.current) {
      console.log('Cleaning up existing Socket.IO connection')
      socketRef.current.close()
      socketRef.current = null
    }

    const devCandidates = [
      typeof window !== 'undefined' ? window.location.origin : '',
      'http://localhost:3004',
      'http://localhost:3010'
    ].filter(Boolean)
    const candidates = process.env.NODE_ENV === 'production' ? [window.location.origin] : devCandidates

    let selectedUrl = candidates[0]
    const newSocket = io(selectedUrl, {
      path: '/api/socket',
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 5000,
      forceNew: true
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to Socket.io server')
      console.log('Token being sent for authentication:', token ? 'token exists' : 'no token')
      setIsConnected(true)
      setError(null)

      // Authenticate with token
      newSocket.emit('authenticate', token)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.io server:', reason)
      setIsConnected(false)

      // Only show error for unexpected disconnections
      if (reason === 'io server disconnect') {
        console.log('Server initiated disconnect - will reconnect automatically')
      }
    })

    newSocket.on('connect_error', (error) => {
      setIsConnected(false)
      setError(null)
      // Try next candidate URL once on initial failure
      const nextIdx = candidates.indexOf(selectedUrl) + 1
      if (nextIdx < candidates.length) {
        selectedUrl = candidates[nextIdx]
        try {
          const fallback = io(selectedUrl, {
            path: '/api/socket',
            transports: ['polling', 'websocket'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 5000,
            forceNew: true
          })
          socketRef.current = fallback
          setSocket(fallback)
          fallback.on('connect', () => {
            setIsConnected(true)
            setError(null)
            fallback.emit('authenticate', token as any)
          })
        } catch {}
      }
    })

    // Authentication events
    newSocket.on('authenticated', (data) => {
      console.log('Socket authenticated:', data)
    })

    newSocket.on('authentication_error', (data) => {
      // Temporarily silence this error while debugging the root cause
      // console.error('Socket authentication error:', data)
      // Don't set error state for auth failures - this can happen during navigation
      // setError('Authentication failed')
    })

    // Error handling
    newSocket.on('error', (error) => {
      const msg = typeof error === 'string' ? error : (error && (error as any).message) || null
      if (msg) {
        console.warn('Socket error:', msg)
        setError(msg)
      } else {
        // Silently ignore empty error payloads from transport layer
        setError(null)
      }
    })

    return () => {
      newSocket.close()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [user?.id, token]) // Only reconnect when user ID or token actually changes

  const joinGroup = (groupId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join_group', groupId)
    }
  }

  const leaveGroup = (groupId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_group', groupId)
    }
  }

  const joinSession = (sessionId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join_session', sessionId)
    }
  }

  const notifyFeedbackSubmitted = (sessionId: string, targetUserId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('feedback_submitted', { sessionId, targetUserId })
    }
  }

  const notifySessionStatusChange = (sessionId: string, status: string) => {
    if (socketRef.current) {
      socketRef.current.emit('session_status_change', { sessionId, status })
    }
  }

  const startTyping = (_sessionId: string, _targetUserId?: string) => {
    // Activity status removed: do not emit typing events
    return
  }

  const stopTyping = (_sessionId: string, _targetUserId?: string) => {
    // Activity status removed: do not emit typing events
    return
  }

  const notifyMemberJoinedGroup = (groupId: string, memberInfo: any) => {
    if (socketRef.current) {
      socketRef.current.emit('member_joined_group', { groupId, memberInfo })
    }
  }

  const notifyMemberLeftGroup = (groupId: string, memberInfo: any) => {
    if (socketRef.current) {
      socketRef.current.emit('member_left_group', { groupId, memberInfo })
    }
  }

  const notifyGroupCreated = (group: any) => {
    if (socketRef.current) {
      socketRef.current.emit('group_created', { group })
    }
  }

  const notifyGroupDeleted = (groupId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('group_deleted', { groupId })
    }
  }

  const sendDirectMessage = (toUserId: string, content: string) => {
    if (socketRef.current) {
      socketRef.current.emit('direct_message', { toUserId, content })
    }
  }

  const onDirectMessage = (callback: (data: { fromUserId: string, content: string, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('direct_message') } catch {}
      socketRef.current.on('direct_message', callback)
    }
  }

  const onDirectMessageAck = (callback: (data: { toUserId: string, content: string, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('direct_message_ack') } catch {}
      socketRef.current.on('direct_message_ack', callback)
    }
  }

  const onDirectMessageError = (callback: (data: { code: string, message?: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('direct_message_error') } catch {}
      socketRef.current.on('direct_message_error', callback)
    }
  }

  const onGroupMemberJoined = (callback: (data: { groupId: string, memberInfo: any, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('group_member_joined') } catch {}
      socketRef.current.on('group_member_joined', callback)
    }
  }

  const onGroupMemberLeft = (callback: (data: { groupId: string, memberInfo: any, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('group_member_left') } catch {}
      socketRef.current.on('group_member_left', callback)
    }
  }

  const onGroupCreated = (callback: (data: { group: any, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('group_created') } catch {}
      socketRef.current.on('group_created', callback)
    }
  }

  const onGroupDeleted = (callback: (data: { groupId: string, timestamp: string }) => void) => {
    if (socketRef.current) {
      try { socketRef.current.off('group_deleted') } catch {}
      socketRef.current.on('group_deleted', callback)
    }
  }

  return {
    socket,
    isConnected,
    error,
    joinGroup,
    leaveGroup,
    joinSession,
    notifyFeedbackSubmitted,
    notifySessionStatusChange,
    startTyping,
    stopTyping,
    notifyMemberJoinedGroup,
    onGroupMemberJoined,
    notifyMemberLeftGroup,
    onGroupMemberLeft,
    notifyGroupCreated,
    onGroupCreated,
    notifyGroupDeleted,
    onGroupDeleted,
    sendDirectMessage,
    onDirectMessage,
    onDirectMessageAck,
    onDirectMessageError
  }
}
