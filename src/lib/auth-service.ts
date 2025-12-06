import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from './prisma'
import { NotificationService } from './notifications'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  username: string
  password: string
  fullName: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
  fullName: string
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
  private static readonly SALT_ROUNDS = 10

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.JWT_SECRET,
      { expiresIn: '7d' }
    )
  }

  static verifyToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as { userId: string }
    } catch {
      return null
    }
  }

  static async registerUser(data: RegisterData): Promise<{ user: AuthUser; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email.toLowerCase() },
            { username: data.username.toLowerCase() }
          ]
        }
      })

      if (existingUser) {
        if (existingUser.email === data.email.toLowerCase()) {
          throw new Error('Email already registered')
        }
        if (existingUser.username === data.username.toLowerCase()) {
          throw new Error('Username already taken')
        }
      }

      // Hash password
      const passwordHash = await this.hashPassword(data.password)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          username: data.username.toLowerCase(),
          passwordHash,
          fullName: data.fullName
        }
      })

      // Generate token
      const token = this.generateToken(user.id)

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      // Log audit event
      await this.logAuditEvent(user.id, 'USER_REGISTER', 'User', user.id, {
        email: data.email,
        username: data.username
      })

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt || undefined
        },
        token
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      throw error
    }
  }

  static async loginUser(credentials: LoginCredentials): Promise<{ user: AuthUser; token: string }> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() }
      })

      if (!user) {
        throw new Error('Invalid credentials')
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(credentials.password, user.passwordHash)
      if (!isValidPassword) {
        throw new Error('Invalid credentials')
      }

      // Generate token
      const token = this.generateToken(user.id)

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      // Log audit event
      await this.logAuditEvent(user.id, 'USER_LOGIN', 'User', user.id, {
        email: credentials.email
      })

      const latestSettings = await prisma.auditLog.findFirst({
        where: { userId: user.id, action: 'USER_SETTINGS' },
        orderBy: { occurredAt: 'desc' }
      })
      let stored: any = null
      try { stored = latestSettings?.details ? JSON.parse(latestSettings.details as string) : null } catch {}
      if (stored?.loginAlertsEnabled) {
        await NotificationService.createNotification({
          userId: user.id,
          type: 'system',
          title: 'New Login',
          message: 'A new login to your account was detected',
          data: { email: credentials.email, timestamp: new Date().toISOString() }
        })
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt || undefined
        },
        token
      }
    } catch (error: any) {
      console.error('Login error:', error)
      throw error
    }
  }

  static async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt || undefined
      }
    } catch (error) {
      console.error('Get user error:', error)
      return null
    }
  }

  static async checkRateLimit(
    identifier: string,
    action: string,
    maxRequests: number = 10,
    windowMinutes: number = 15
  ): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

      // Clean old rate limits
      await prisma.rateLimit.deleteMany({
        where: {
          action,
          windowStart: {
            lt: windowStart
          }
        }
      })

      // Check current rate limit
      const currentLimit = await prisma.rateLimit.findUnique({
        where: {
          identifier_action: {
            identifier,
            action
          }
        }
      })

      if (!currentLimit) {
        // Create new rate limit entry
        await prisma.rateLimit.create({
          data: {
            identifier,
            action,
            requests: 1,
            windowStart: new Date()
          }
        })
        return true
      }

      // Reset if window expired
      if (currentLimit.windowStart < windowStart) {
        await prisma.rateLimit.update({
          where: { id: currentLimit.id },
          data: {
            requests: 1,
            windowStart: new Date()
          }
        })
        return true
      }

      // Check if under limit
      if (currentLimit.requests >= maxRequests) {
        return false
      }

      // Increment request count
      await prisma.rateLimit.update({
        where: { id: currentLimit.id },
        data: {
          requests: currentLimit.requests + 1
        }
      })

      return true
    } catch (error) {
      console.error('Rate limit check error:', error)
      // Fail open - allow request if rate limiting fails
      return true
    }
  }

  static async logAuditEvent(
    userId?: string,
    action?: string,
    resource?: string,
    resourceId?: string,
    details?: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action || 'UNKNOWN',
          resource: resource || 'UNKNOWN',
          resourceId,
          details: details ? JSON.stringify(details) : null
        }
      })
    } catch (error) {
      console.error('Audit log error:', error)
      // Don't throw - audit logging failures shouldn't break the app
    }
  }
}

if (!process.env.JWT_SECRET) {
  ;(process.env as any).JWT_SECRET = (AuthService as any).JWT_SECRET
}
