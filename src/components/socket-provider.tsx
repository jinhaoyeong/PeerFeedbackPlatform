'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useSocket as useSocketHook } from '@/hooks/use-socket'
import { Socket } from 'socket.io-client'

interface SocketContextType {
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
  notifyGroupCreated: (group: any) => void
  onGroupCreated: (callback: (data: { group: any, timestamp: string }) => void) => void
  notifyGroupDeleted: (groupId: string) => void
  onGroupDeleted: (callback: (data: { groupId: string, timestamp: string }) => void) => void
  sendDirectMessage: (toUserId: string, content: string) => void
  onDirectMessage: (callback: (data: { fromUserId: string, content: string, timestamp: string }) => void) => void
  onDirectMessageAck: (callback: (data: { toUserId: string, content: string, timestamp: string }) => void) => void
  onDirectMessageError: (callback: (data: { code: string, message?: string }) => void) => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socketHook = useSocketHook()

  const value: SocketContextType = {
    socket: socketHook.socket,
    isConnected: socketHook.isConnected,
    error: socketHook.error,
    joinGroup: socketHook.joinGroup,
    leaveGroup: socketHook.leaveGroup,
    joinSession: socketHook.joinSession,
    notifyFeedbackSubmitted: socketHook.notifyFeedbackSubmitted,
    notifySessionStatusChange: socketHook.notifySessionStatusChange,
    startTyping: socketHook.startTyping,
    stopTyping: socketHook.stopTyping,
    notifyMemberJoinedGroup: socketHook.notifyMemberJoinedGroup,
    onGroupMemberJoined: socketHook.onGroupMemberJoined,
    notifyMemberLeftGroup: (socketHook as any).notifyMemberLeftGroup,
    onGroupMemberLeft: (socketHook as any).onGroupMemberLeft,
    notifyGroupCreated: (socketHook as any).notifyGroupCreated,
    onGroupCreated: (socketHook as any).onGroupCreated,
    notifyGroupDeleted: (socketHook as any).notifyGroupDeleted,
    onGroupDeleted: (socketHook as any).onGroupDeleted,
    sendDirectMessage: (socketHook as any).sendDirectMessage,
    onDirectMessage: (socketHook as any).onDirectMessage,
    onDirectMessageAck: (socketHook as any).onDirectMessageAck,
    onDirectMessageError: (socketHook as any).onDirectMessageError
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
