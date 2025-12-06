'use client'

import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react'
import { useAuth } from './auth-provider'
import { ClientNotificationService } from '@/lib/client-notifications'
import { Notification } from '@/lib/notifications'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  refreshNotifications: () => Promise<void>
  createSystemNotification: (title: string, message: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const { user } = useAuth()

  // Load notifications when user changes
  useEffect(() => {
    if (user) {
      loadUserNotifications()
    } else {
      // Clear notifications when user logs out
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user])

  // Poll notifications periodically to reflect server-side events (e.g., member joins)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const userNotifications = await ClientNotificationService.getUserNotifications(20, 0, false)
        setNotifications(userNotifications)
        const count = await ClientNotificationService.getUnreadCount()
        setUnreadCount(count)
      } catch {}
    }
    const id = setInterval(poll, 4000)
    const onFocus = () => poll()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id])

  const loadUserNotifications = async () => {
    if (!user) return

    try {
      const userNotifications = await ClientNotificationService.getUserNotifications(20, 0, false)
      setNotifications(userNotifications)

      const count = await ClientNotificationService.getUnreadCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading user notifications:', error)
    }
  }

  const refreshNotifications = useCallback(async () => {
    await loadUserNotifications()
  }, [user])

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
    try {
      const newNotification = await ClientNotificationService.createNotification({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
      })

      setNotifications(prev => [newNotification, ...prev])
      setUnreadCount(prev => prev + 1)
    } catch (error) {
      console.error('Error adding notification:', error)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await ClientNotificationService.markAsRead(notificationId)

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      )

      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await ClientNotificationService.markAllAsRead()

      setNotifications(prev =>
        prev.map(notification => ({ ...notification, isRead: true }))
      )

      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [])

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await ClientNotificationService.deleteNotification(notificationId)

      const deletedNotification = notifications.find(n => n.id === notificationId)

      setNotifications(prev =>
        prev.filter(notification => notification.id !== notificationId)
      )

      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [notifications])

  const createSystemNotification = useCallback(async (title: string, message: string) => {
    // Create a system notification (these are typically shown to all users)
    console.log('Creating system notification:', { title, message })
    // In a real implementation, you might broadcast this to all connected users
  }, [])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    createSystemNotification,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
