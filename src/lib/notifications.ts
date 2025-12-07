import { prisma } from './prisma'
import nodemailer from 'nodemailer'

export interface NotificationData {
  userId: string
  type: 'feedback' | 'group_invite' | 'session_update' | 'system' | 'session_invitation' | 'group_member_left'
  title: string
  message: string
  data?: any
}

export interface Notification {
  id: string
  userId: string
  type: 'feedback' | 'group_invite' | 'session_update' | 'system' | 'session_invitation' | 'group_member_left'
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  data?: any
}

export class NotificationService {
  private static async getUserSettings(userId: string): Promise<{ pushNotifications: boolean; emailNotifications: boolean }>
  {
    try {
      const latest = await prisma.auditLog.findFirst({
        where: { userId, action: 'USER_SETTINGS' },
        orderBy: { occurredAt: 'desc' }
      })
      let stored: any = null
      try { stored = latest?.details ? JSON.parse(latest.details as string) : null } catch {}
      return {
        pushNotifications: !!(stored?.pushNotifications ?? false),
        emailNotifications: !!(stored?.emailNotifications ?? true)
      }
    } catch {
      return { pushNotifications: false, emailNotifications: true }
    }
  }

  static async createNotification(data: NotificationData): Promise<Notification> {
    try {
      const settings = await this.getUserSettings(data.userId)
      if (!settings.pushNotifications) {
        return {
          id: `suppressed:${Date.now()}` as any,
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          isRead: true,
          createdAt: new Date(),
          data: data.data
        }
      }
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          isRead: false,
          data: data.data ? JSON.stringify(data.data) : null,
        },
      })

      return {
        ...notification,
        data: notification.data ? JSON.parse(notification.data as string) : undefined,
      }
    } catch (error) {
      console.error('Error creating notification:', error)
      throw new Error('Failed to create notification')
    }
  }

  static async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      const settings = await this.getUserSettings(userId)
      if (!settings.pushNotifications) {
        return []
      }
      const whereClause: any = { userId }
      if (unreadOnly) {
        whereClause.isRead = false
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      })

      return notifications.map((notification: any) => ({
        ...notification,
        data: notification.data ? JSON.parse(notification.data as string) : undefined,
      }))
    } catch (error) {
      console.error('Error getting notifications:', error)
      return []
    }
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // Verify the notification belongs to the user
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      })

      if (!notification) {
        throw new Error('Notification not found')
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  static async markAllAsRead(userId: string): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // Verify the notification belongs to the user
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      })

      if (!notification) {
        throw new Error('Notification not found')
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  }

  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const settings = await this.getUserSettings(userId)
      if (!settings.pushNotifications) {
        return 0
      }
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      })
      return count
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Helper methods to create different types of notifications
  static async notifyFeedbackReceived(
    targetUserId: string,
    submitterName: string,
    sessionName: string
  ): Promise<void> {
    await this.createNotification({
      userId: targetUserId,
      type: 'feedback',
      title: 'New Feedback Received',
      message: `${submitterName} gave you feedback on "${sessionName}"`,
      data: { submitterName, sessionName },
    })
  }

  static async notifyGroupInvite(
    userId: string,
    groupName: string,
    inviterName: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'group_invite',
      title: 'Group Invitation',
      message: `${inviterName} invited you to join "${groupName}"`,
      data: { groupName, inviterName },
    })
  }

  static async notifySessionUpdate(
    userId: string,
    sessionName: string,
    status: string,
    updatedBy?: string
  ): Promise<void> {
    const message = updatedBy
      ? `${updatedBy} updated "${sessionName}" to ${status}`
      : `"${sessionName}" status changed to ${status}`

    await this.createNotification({
      userId,
      type: 'session_update',
      title: 'Session Status Changed',
      message,
      data: { sessionName, status, updatedBy },
    })
  }

  static async notifySessionInvitation(
    userId: string,
    sessionName: string,
    creatorName: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'session_invitation',
      title: 'Feedback Session Invitation',
      message: `${creatorName} invited you to participate in "${sessionName}"`,
      data: { sessionName, creatorName },
    })
  }

  static async notifyWelcome(userId: string, userName: string): Promise<void> {
    await this.createNotification({
      userId,
      type: 'system',
      title: 'Welcome to Peer Feedback Platform!',
      message: `Hi ${userName}! Get started by joining a group or creating your first feedback session.`,
      data: { userName },
    })
  }

  static async sendEmail(userId: string, subject: string, text: string, html?: string, options?: { force?: boolean }): Promise<void> {
    const { emailNotifications } = await this.getUserSettings(userId)
    const force = !!options?.force
    if (!emailNotifications && !force) return
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true }
    })
    if (!user?.email) {
      throw new Error('Email address not found')
    }

    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = process.env.SMTP_SECURE === 'true' || port === 465
    const authUser = process.env.SMTP_USER
    const authPass = process.env.SMTP_PASS
    const from = process.env.EMAIL_FROM || 'no-reply@peerfeedback.local'
    const service = process.env.SMTP_SERVICE
    const url = process.env.SMTP_URL
    const hasConfig = !!(url || service || host)

    let transporter: nodemailer.Transporter
    let usingEthereal = false

    if (url) {
      transporter = nodemailer.createTransport(url)
    } else if (service && authUser && authPass) {
      transporter = nodemailer.createTransport({ service, auth: { user: authUser, pass: authPass }, connectionTimeout: 10000, socketTimeout: 10000 })
    } else if (host && authUser && authPass) {
      transporter = nodemailer.createTransport({ host, port, secure, auth: { user: authUser, pass: authPass }, connectionTimeout: 10000, socketTimeout: 10000 })
    } else {
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        connectionTimeout: 10000,
        socketTimeout: 10000
      })
      usingEthereal = true
    }

    const brand = process.env.APP_NAME || 'Peer Feedback Platform'
    const baseUrl = process.env.NEXTAUTH_URL || ''
    const inner = html || `<p>${text}</p>`
    const wrapper = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#0f172a"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb"><tr><td align="center" style="padding:24px"><table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border-radius:14px;box-shadow:0 2px 8px rgba(15,23,42,.06);overflow:hidden"><tr><td style="padding:20px 24px;background:#111827;color:#ffffff;font-size:16px;font-weight:700">${brand}</td></tr><tr><td style="padding:24px">${inner}</td></tr><tr><td style="padding:18px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">If you didn’t initiate this action, secure your account and review settings.<br/><a href="${baseUrl}/settings" style="color:#2563eb;text-decoration:none">Open Settings</a></td></tr></table></td></tr></table></body></html>`

    const sendWithTimeout = <T>(p: Promise<T>, ms: number): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Email send timeout')), ms)
        p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
      })
    }

    try {
      const info = await sendWithTimeout(transporter.sendMail({
        from,
        to: user.email,
        subject,
        text,
        html: wrapper
      }), 12000)
      if (usingEthereal) {
        const preview = nodemailer.getTestMessageUrl(info)
        console.log('Ethereal email preview URL:', preview)
      }
    } catch (error) {
      if (hasConfig) {
        try {
          const testAccount = await nodemailer.createTestAccount()
          const fallbackTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
            connectionTimeout: 10000,
            socketTimeout: 10000
          })
          const info = await sendWithTimeout(fallbackTransporter.sendMail({
            from,
            to: user.email,
            subject,
            text,
            html: wrapper
          }), 12000)
          const preview = nodemailer.getTestMessageUrl(info)
          console.error('Email send failed; Ethereal fallback used:', error)
          console.log('Ethereal email preview URL:', preview)
        } catch (fallbackError) {
          console.error('Email send failed and fallback failed:', fallbackError)
          throw fallbackError
        }
      } else {
        throw error as any
      }
    }
  }
}
