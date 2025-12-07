import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { NotificationService } from '@/lib/notifications'

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

    try {
      const ua = request.headers.get('user-agent') || 'unknown'
      const isLocal = ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress === '::ffff:127.0.0.1'
      const displayIp = isLocal ? 'localhost' : ipAddress
      let tz = 'UTC'
      let loginAlertsEnabled = false
      try {
        const latest = await prisma.auditLog.findFirst({ where: { userId: userRecord.id, action: 'USER_SETTINGS' }, orderBy: { occurredAt: 'desc' } })
        const stored = latest?.details ? JSON.parse(latest.details as string) : null
        tz = String(stored?.timezone || 'UTC')
        loginAlertsEnabled = !!stored?.loginAlertsEnabled
      } catch {}
      if (loginAlertsEnabled) {
        const now = new Date()
        let timeStr = now.toLocaleString('en-US')
        try { timeStr = now.toLocaleString('en-US', { timeZone: tz }) } catch {}
        const app = process.env.APP_NAME || 'Peer Feedback Platform'
        const html = `<div style="font-size:15px;color:#111827"><p style="margin:0 0 10px">Hi ${userRecord.fullName},</p><p style="margin:0 0 14px">A new login to your account was detected.</p><div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;line-height:1.6"><span style="color:#6b7280">IP</span><span style="font-weight:600">${displayIp}</span></div><div style="display:flex;justify-content:space-between;line-height:1.6"><span style="color:#6b7280">Device</span><span style="font-weight:600">${ua}</span></div><div style="display:flex;justify-content:space-between;line-height:1.6"><span style="color:#6b7280">Time</span><span style="font-weight:600">${timeStr} (${tz})</span></div></div><p style="margin:12px 0 0">If this wasn’t you, change your password and review settings.</p><p style="margin:6px 0 0"><a href="${process.env.NEXTAUTH_URL || ''}/settings" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">Open Settings</a></p><p style="margin:10px 0 0;color:#6b7280">Sent by ${app}</p></div>`
        await NotificationService.sendEmail(
          userRecord.id,
          'Login Alert',
          `A new login to your account was detected from ${displayIp}.`,
          html,
          { force: true }
        )
      }
    } catch {}

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
