import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { AuthService } from '@/lib/auth-service'
import bcrypt from 'bcryptjs'
import { NotificationService } from '@/lib/notifications'

function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const decoded = AuthService.verifyToken(token)
    return decoded
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        privacySettings: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            feedbackGiven: true,
            feedbackReceived: true,
            groupsCreated: true,
            groupMembers: true
          }
        }
      }
    })

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: userProfile })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fullName, username, currentPassword, newPassword, privacySettings } = body

    // Check if username is already taken by another user
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: user.userId }
        }
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (fullName !== undefined) updateData.fullName = fullName
    if (username !== undefined) updateData.username = username

    // Handle password change
    if (currentPassword && newPassword) {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true }
      })

      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash)
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        )
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 12)
      updateData.passwordHash = hashedNewPassword
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        updatedAt: true
      }
    })

    // Update privacy settings if provided
    if (privacySettings) {
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          privacySettings: {
            upsert: {
              create: privacySettings,
              update: privacySettings
            }
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: updatedUser
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, currentPassword, newPassword, code } = body

    if (action === 'verify') {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
      }
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true }
      })
      if (!currentUser || !currentUser.passwordHash) {
        return NextResponse.json({ error: 'No password set' }, { status: 400 })
      }
      const isValid = await bcrypt.compare(currentPassword, currentUser.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
      return NextResponse.json({ valid: true })
    }

    if (action === 'password_change_request') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
      }
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true, email: true, fullName: true, twoFAEnabled: true }
      })
      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash)
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
      if (String(newPassword).length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
      }
      const hashedNewPassword = await bcrypt.hash(newPassword, 12)
      if (!(currentUser as any)?.twoFAEnabled) {
        await prisma.user.update({
          where: { id: user.userId },
          data: { passwordHash: hashedNewPassword }
        })
        await AuthService.logAuditEvent(user.userId, 'PASSWORD_CHANGED', 'User', user.userId, { method: '2fa_off' })
        try {
          await NotificationService.sendEmail(
            user.userId,
            'Your password was changed',
            'Your account password was changed successfully.',
            `<p>Your account password was changed successfully on ${new Date().toLocaleString()}.</p>`,
            { force: true }
          )
        } catch {}
        return NextResponse.json({ message: 'Password updated successfully' })
      }
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      const codeHash = await bcrypt.hash(verificationCode, 10)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await AuthService.logAuditEvent(user.userId, 'PASSWORD_CHANGE_REQUEST', 'User', user.userId, {
        codeHash,
        hashedNewPassword,
        expiresAt: expiresAt.toISOString()
      })
      try {
        await NotificationService.sendEmail(
          user.userId,
          'Password change verification code',
          `Use this code to confirm your password change: ${verificationCode}`,
          `<p>Use this code to confirm your password change:</p><h2>${verificationCode}</h2><p>This code expires at ${expiresAt.toLocaleString()}.</p>`
        )
      } catch (e) {
        return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
      }
      return NextResponse.json({ message: 'Verification code sent to email' })
    }

    if (action === 'password_change_confirm') {
      if (!code) {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
      }
      const latest = await prisma.auditLog.findFirst({
        where: { userId: user.userId, action: 'PASSWORD_CHANGE_REQUEST' },
        orderBy: { occurredAt: 'desc' }
      })
      let details: any = null
      try { details = latest?.details ? JSON.parse(latest.details as string) : null } catch {}
      const codeHash = details?.codeHash
      const hashedNewPassword = details?.hashedNewPassword
      const expiresAtStr = details?.expiresAt
      if (!codeHash || !hashedNewPassword || !expiresAtStr) {
        return NextResponse.json({ error: 'No password change request found' }, { status: 400 })
      }
      const expiresAt = new Date(expiresAtStr)
      if (expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ error: 'Verification code expired' }, { status: 400 })
      }
      const ok = await bcrypt.compare(String(code), codeHash)
      if (!ok) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: user.userId },
        data: { passwordHash: hashedNewPassword }
      })
      await AuthService.logAuditEvent(user.userId, 'PASSWORD_CHANGED', 'User', user.userId, { method: 'email_code' })
      try {
        await NotificationService.sendEmail(
          user.userId,
          'Your password was changed',
          'Your account password was changed successfully.',
          `<p>Your account password was changed successfully on ${new Date().toLocaleString()}.</p>`,
          { force: true }
        )
      } catch {}
      return NextResponse.json({ message: 'Password updated successfully' })
    }

    if (action === 'change') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
      }
      const currentUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true }
      })
      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash)
      if (!isCurrentPasswordValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
      const hashedNewPassword = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: user.userId },
        data: { passwordHash: hashedNewPassword }
      })
      try {
        await NotificationService.sendEmail(
          user.userId,
          'Your password was changed',
          'Your account password was changed successfully.',
          `<p>Your account password was changed successfully on ${new Date().toLocaleString()}.</p>`,
          { force: true }
        )
      } catch {}
      return NextResponse.json({ message: 'Password updated successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling profile POST:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
