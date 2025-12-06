import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const canProceed = await AuthService.checkRateLimit(
      ipAddress,
      'login',
      10, // max 10 attempts
      15 // per 15 minutes
    )

    if (!canProceed) {
      return NextResponse.json(
        { message: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const userRecord = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    })

    if (!userRecord) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const validPassword = await AuthService.verifyPassword(password, userRecord.passwordHash)
    if (!validPassword) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (userRecord.twoFAEnabled) {
      const tempToken = jwt.sign(
        { userId: userRecord.id, twofa: 'pending' },
        (process.env.JWT_SECRET || 'fallback-secret-key'),
        { expiresIn: '10m' }
      )

      return NextResponse.json({
        requires2FA: true,
        tempToken,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          username: userRecord.username,
          fullName: userRecord.fullName,
        }
      })
    }

    // Otherwise complete login immediately
    const token = AuthService.generateToken(userRecord.id)

    await prisma.user.update({
      where: { id: userRecord.id },
      data: { lastLoginAt: new Date() }
    })

    await AuthService.logAuditEvent(userRecord.id, 'USER_LOGIN', 'User', userRecord.id, {
      email: email.trim().toLowerCase()
    })

    const user = {
      id: userRecord.id,
      email: userRecord.email,
      username: userRecord.username,
      fullName: userRecord.fullName,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      lastLoginAt: userRecord.lastLoginAt || undefined
    }

    // Set HTTP-only cookie for better security
    const response = NextResponse.json({
      user,
      token,
      message: 'Login successful'
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response

  } catch (error: any) {
    console.error('Login error:', error)

    // Handle specific error cases
    if (error.message && error.message.includes('Invalid credentials')) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { message: 'Login failed. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}
