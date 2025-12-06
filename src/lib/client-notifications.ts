import { Notification } from './notifications'

export class ClientNotificationService {
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth-token')
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    }
  }

  static async getUserNotifications(
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(unreadOnly && { unreadOnly: 'true' })
      })

      const response = await fetch(`/api/notifications?${params}`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()
      return data.notifications
    } catch (error) {
      console.error('Error fetching notifications:', error)
      return []
    }
  }

  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  static async markAllAsRead(): Promise<void> {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read')
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete notification')
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  static async getUnreadCount(): Promise<number> {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Failed to get unread count')
      }

      const data = await response.json()
      return data.count
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  static async createNotification(data: {
    type: 'feedback' | 'group_invite' | 'session_update' | 'system' | 'session_invitation' | 'group_member_left'
    title: string
    message: string
    data?: any
  }): Promise<Notification> {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to create notification')
      }

      const result = await response.json()
      return result.notification
    } catch (error) {
      console.error('Error creating notification:', error)
      throw error
    }
  }
}
