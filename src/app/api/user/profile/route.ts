import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { AuthService } from '@/lib/auth-service'
import bcrypt from 'bcryptjs'

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
    const { action, currentPassword, newPassword } = body

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
