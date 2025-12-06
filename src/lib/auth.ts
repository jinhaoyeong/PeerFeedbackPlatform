import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './database'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

export interface JWTPayload {
  userId: string
  email: string
  username: string
}

export class AuthService {
  // Secure password hashing with salt rounds
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return bcrypt.hash(password, saltRounds)
  }

  // Verify password with timing attack protection
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  // Generate secure JWT token
  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '7d',
      issuer: 'peer-feedback-platform',
      audience: 'peer-feedback-users'
    })
  }

  // Verify JWT token with comprehensive error handling
  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: 'peer-feedback-platform',
        audience: 'peer-feedback-users'
      }) as JWTPayload
    } catch (error) {
      // Log specific JWT errors for monitoring
      if (error instanceof jwt.TokenExpiredError) {
        console.warn('JWT token expired:', error.expiredAt)
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.warn('Invalid JWT token:', error.message)
      } else {
        console.error('JWT verification error:', error)
      }
      return null
    }
  }

  // Secure user registration with validation
  static async registerUser(userData: {
    email: string
    username: string
    password: string
    fullName: string
  }): Promise<{ user: any; token: string }> {
    const { email, username, password, fullName } = userData

    // Check for existing users
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    })

    if (existingUser) {
      throw new Error('User with this email or username already exists')
    }

    // Validate input
    this.validateUserData({ email, username, password, fullName })

    // Hash password securely
    const passwordHash = await this.hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        fullName,
        passwordHash,
      },
    })

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    })

    // Log registration for security
    await this.logAudit('USER_REGISTERED', user.id, 'users', user.id)

    return { user, token }
  }

  // Secure user login with rate limiting consideration
  static async loginUser(credentials: {
    email: string
    password: string
  }): Promise<{ user: any; token: string }> {
    const { email, password } = credentials

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    })

    // Log login for security
    await this.logAudit('USER_LOGIN', user.id, 'users', user.id)

    return { user, token }
  }

  // Validate user input data
  private static validateUserData(userData: {
    email: string
    username: string
    password: string
    fullName: string
  }): void {
    const { email, username, password, fullName } = userData

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }

    // Username validation (3-20 chars, alphanumeric + underscores)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      throw new Error('Username must be 3-20 characters, alphanumeric and underscores only')
    }

    // Password validation (minimum 8 chars, complexity requirements)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
      throw new Error('Password must contain uppercase, lowercase, and numbers')
    }

    // Full name validation
    if (fullName.trim().length < 2) {
      throw new Error('Full name must be at least 2 characters long')
    }
  }

  // Log audit events for security and compliance
  private static async logAudit(
    action: string,
    userId: string,
    resource: string,
    resourceId: string,
    details?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          resource,
          resourceId,
          details,
          occurredAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
      // Don't throw error to avoid breaking main flow
    }
  }

  // Check rate limiting for security
  static async checkRateLimit(
    identifier: string,
    action: string,
    maxRequests: number = 10,
    windowMinutes: number = 15
  ): Promise<boolean> {
    const windowStart = new Date()
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes)

    try {
      // Clean old rate limit records
      await prisma.rateLimit.deleteMany({
        where: {
          windowStart: { lt: windowStart }
        }
      })

      // Get current rate limit record
      const rateLimit = await prisma.rateLimit.findUnique({
        where: { identifier_action: { identifier, action } }
      })

      if (!rateLimit) {
        // Create new rate limit record
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

      // Check if exceeded
      if (rateLimit.requests >= maxRequests) {
        return false
      }

      // Increment requests
      await prisma.rateLimit.update({
        where: { identifier_action: { identifier, action } },
        data: { requests: { increment: 1 } }
      })

      return true
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Allow request if rate limiting fails (fail open)
      return true
    }
  }
}