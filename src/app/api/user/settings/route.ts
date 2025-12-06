import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
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

    const url = new URL(request.url)
    const userIdParam = url.searchParams.get('userId')
    const targetUserId = userIdParam || user.userId

    const latest = await prisma.auditLog.findFirst({
      where: { userId: targetUserId, action: 'USER_SETTINGS' },
      orderBy: { occurredAt: 'desc' }
    })

    let stored: any = null
    try {
      stored = latest?.details ? JSON.parse(latest.details) : null
    } catch {}

    const settings = {
      emailNotifications: stored?.emailNotifications ?? true,
      darkMode: stored?.darkMode ?? false,
      language: stored?.language ?? 'en',
      timezone: stored?.timezone ?? 'UTC',
      allowAnonymousFeedback: stored?.allowAnonymousFeedback ?? true,
      showInGroupDirectory: stored?.showInGroupDirectory ?? true,
      pushNotifications: stored?.pushNotifications ?? false,
      loginAlertsEnabled: stored?.loginAlertsEnabled ?? false,
      showActivityStatus: stored?.showActivityStatus ?? true,
      allowMessaging: stored?.allowMessaging ?? true,
      profileVisibility: stored?.profileVisibility ?? (stored?.showInGroupDirectory === false ? 'private' : 'public')
    }

    const version = Number(stored?.version || 1)
    return NextResponse.json({ settings, version })
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
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
    const { privacySettings, otherSettings } = body

    const merged = {
      emailNotifications: !!privacySettings?.receiveEmailNotifications,
      allowAnonymousFeedback: !!privacySettings?.allowAnonymousFeedback,
      showInGroupDirectory: !!privacySettings?.showInGroupDirectory,
      darkMode: !!otherSettings?.darkMode,
      language: String(otherSettings?.language || 'en'),
      timezone: String(otherSettings?.timezone || 'UTC'),
      pushNotifications: !!(body.pushNotifications ?? false),
      loginAlertsEnabled: !!otherSettings?.loginAlertsEnabled,
      showActivityStatus: !!otherSettings?.showActivityStatus,
      allowMessaging: typeof otherSettings?.allowMessaging === 'undefined' ? true : !!otherSettings?.allowMessaging,
      profileVisibility: String(otherSettings?.profileVisibility || (privacySettings?.showInGroupDirectory === false ? 'private' : 'public'))
    }

    const latest = await prisma.auditLog.findFirst({
      where: { userId: user.userId, action: 'USER_SETTINGS' },
      orderBy: { occurredAt: 'desc' }
    })

    let previous: any = null
    try { previous = latest?.details ? JSON.parse(latest.details) : null } catch {}
    const previousVersion = Number(previous?.version || 1)
    const baseVersion = Number(body.baseVersion || previousVersion)
    if (baseVersion < previousVersion) {
      return NextResponse.json({
        error: 'Version conflict',
        conflict: true,
        latestVersion: previousVersion,
        latestSettings: previous
      }, { status: 409 })
    }
    const newVersion = previousVersion + 1

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'USER_SETTINGS',
        resource: 'User',
        resourceId: user.userId,
        details: JSON.stringify({ ...merged, version: newVersion, updatedAt: new Date().toISOString() })
      }
    })

    return NextResponse.json({
      message: 'Settings updated successfully',
      version: newVersion
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
