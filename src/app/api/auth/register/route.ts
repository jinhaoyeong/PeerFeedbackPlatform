import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'
import { NotificationService } from '@/lib/notifications'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, username, password, fullName } = body

    // Comprehensive validation
    const validationErrors: string[] = []

    if (!email) {
      validationErrors.push('Email is required')
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        validationErrors.push('Invalid email format')
      }
    }

    if (!username) {
      validationErrors.push('Username is required')
    } else if (username.length < 3) {
      validationErrors.push('Username must be at least 3 characters long')
    } else if (username.length > 20) {
      validationErrors.push('Username must be 20 characters or less')
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      validationErrors.push('Username can only contain letters, numbers, underscores, and hyphens')
    }

    if (!password) {
      validationErrors.push('Password is required')
    } else if (password.length < 8) {
      validationErrors.push('Password must be at least 8 characters long')
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      validationErrors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    }

    if (!fullName) {
      validationErrors.push('Full name is required')
    } else if (fullName.length < 2) {
      validationErrors.push('Full name must be at least 2 characters long')
    } else if (fullName.length > 50) {
      validationErrors.push('Full name must be 50 characters or less')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          message: 'Validation failed',
          errors: validationErrors
        },
        { status: 400 }
      )
    }

    // Rate limiting check (disabled in development or when IP is unavailable)
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const isDev = process.env.NODE_ENV !== 'production'
    const skipRateLimit = isDev || ipAddress === 'unknown' || process.env.DISABLE_RATE_LIMIT === 'true'
    const canProceed = skipRateLimit
      ? true
      : await AuthService.checkRateLimit(
          ipAddress,
          'register',
          5, // max 5 attempts
          60 // per hour
        )

    if (!canProceed) {
      return NextResponse.json(
        { message: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Register user
    const { user, token } = await AuthService.registerUser({
      email: email.trim().toLowerCase(),
      username: username.trim(),
      password,
      fullName: fullName.trim()
    })

    // Set HTTP-only cookie for better security
    try {
      await NotificationService.sendEmail(
        user.id,
        'Welcome to Peer Feedback Platform',
        `Hi ${user.fullName}, your account was created successfully.`,
        `<p>Hi ${user.fullName},</p><p>Your account was created successfully.</p><p>Welcome aboard!</p>`,
        { force: true }
      )
    } catch {}

    const response = NextResponse.json({
      user,
      token,
      message: 'Registration successful'
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response

  } catch (error: any) {
    console.error('Registration error:', error)

    // Handle specific error cases
    if (error.message.includes('already registered') || error.message.includes('already taken')) {
      return NextResponse.json(
        { message: error.message },
        { status: 409 }
      )
    }

    if (error.code === 'P2002' || (typeof error.message === 'string' && error.message.includes('Unique constraint'))) {
      return NextResponse.json(
        { message: 'Email or username already exists' },
        { status: 409 }
      )
    }

    // Sanitize Prisma and infrastructure errors
    const prismaConfigError =
      error.code === 'P1012' ||
      (typeof error.message === 'string' &&
        (error.message.includes('Prisma schema validation') ||
         error.message.includes('Datasource') ||
         error.message.includes('prisma.user')))

    if (prismaConfigError) {
      return NextResponse.json(
        { message: 'Server configuration error. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: 'Registration failed. Please try again.',
        detail: typeof error?.message === 'string' ? error.message : 'Unknown error',
        errorCode: error?.code || null
      },
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
