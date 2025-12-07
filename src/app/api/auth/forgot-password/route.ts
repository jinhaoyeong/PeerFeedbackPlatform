import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'
import { NotificationService } from '@/lib/notifications'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, code, newPassword } = body

    if (!action) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
    }

    if (action === 'request') {
      if (!email) {
        return NextResponse.json({ message: 'Email is required' }, { status: 400 })
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(email))) {
        return NextResponse.json({ message: 'Invalid email format' }, { status: 400 })
      }

      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const canProceed = await AuthService.checkRateLimit(ipAddress, 'forgot_password_request', 5, 15)
      if (!canProceed) {
        return NextResponse.json({ message: 'Too many requests. Try later.' }, { status: 429 })
      }

      const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } })
      if (!user) {
        return NextResponse.json({ message: 'If the email exists, a reset code was sent' })
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const codeHash = await bcrypt.hash(verificationCode, 10)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await AuthService.logAuditEvent(user.id, 'FORGOT_PASSWORD_REQUEST', 'User', user.id, {
        codeHash,
        expiresAt: expiresAt.toISOString()
      })

      try {
        await NotificationService.sendEmail(
          user.id,
          'Password reset code',
          `Use this code to reset your password: ${verificationCode}`,
          `<p>Use this code to reset your password:</p><h2>${verificationCode}</h2><p>This code expires at ${expiresAt.toLocaleString()}.</p>`,
          { force: true }
        )
      } catch (e) {
        return NextResponse.json({ message: 'Failed to send reset email' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Reset code sent to email' })
    }

    if (action === 'confirm') {
      if (!email || !code || !newPassword) {
        return NextResponse.json({ message: 'Email, code, and new password are required' }, { status: 400 })
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(email))) {
        return NextResponse.json({ message: 'Invalid email format' }, { status: 400 })
      }
      if (String(newPassword).length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(String(newPassword))) {
        return NextResponse.json({ message: 'Password must contain uppercase, lowercase, numbers and be 8+ chars' }, { status: 400 })
      }

      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const canProceed = await AuthService.checkRateLimit(ipAddress, 'forgot_password_confirm', 10, 15)
      if (!canProceed) {
        return NextResponse.json({ message: 'Too many attempts. Try later.' }, { status: 429 })
      }

      const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } })
      if (!user) {
        return NextResponse.json({ message: 'Invalid code or expired' }, { status: 400 })
      }

      const latest = await prisma.auditLog.findFirst({
        where: { userId: user.id, action: 'FORGOT_PASSWORD_REQUEST' },
        orderBy: { occurredAt: 'desc' }
      })
      let details: any = null
      try { details = latest?.details ? JSON.parse(latest.details as string) : null } catch {}
      const codeHash = details?.codeHash
      const expiresAtStr = details?.expiresAt
      if (!codeHash || !expiresAtStr) {
        return NextResponse.json({ message: 'Invalid code or expired' }, { status: 400 })
      }
      const expiresAt = new Date(expiresAtStr)
      if (expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ message: 'Invalid code or expired' }, { status: 400 })
      }
      const ok = await bcrypt.compare(String(code), codeHash)
      if (!ok) {
        return NextResponse.json({ message: 'Invalid code or expired' }, { status: 400 })
      }

      const hashedNewPassword = await bcrypt.hash(String(newPassword), 12)
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashedNewPassword } })
      await AuthService.logAuditEvent(user.id, 'PASSWORD_CHANGED', 'User', user.id, { method: 'forgot_password' })

      try {
        await NotificationService.sendEmail(
          user.id,
          'Your password was changed',
          'Your account password was changed successfully.',
          `<p>Your account password was changed successfully on ${new Date().toLocaleString()}.</p>`,
          { force: true }
        )
      } catch {}

      return NextResponse.json({ message: 'Password updated successfully' })
    }

    return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to process request' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 })
}

