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
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const viewer = getUserFromToken(request)
    const viewerId = viewer?.userId

    // Find target user
    const targetUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
        }
      },
      include: {
        _count: {
          select: {
            feedbackSubmissions: true, // feedbackGiven
            createdGroups: true,
            groupMemberships: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch settings to check visibility
    const latestSettingsLog = await prisma.auditLog.findFirst({
      where: { userId: targetUser.id, action: 'USER_SETTINGS' },
      orderBy: { occurredAt: 'desc' }
    })

    let settings: any = null
    try {
      settings = latestSettingsLog?.details ? JSON.parse(latestSettingsLog.details) : null
    } catch {}

    const profileVisibility = settings?.profileVisibility || (settings?.showInGroupDirectory === false ? 'private' : 'public')

    // Privacy Check
    let canView = false

    if (viewerId === targetUser.id) {
      canView = true
    } else if (profileVisibility === 'public') {
      canView = true
    } else if (profileVisibility === 'group-members' && viewerId) {
      // Check for shared groups
      const sharedGroup = await prisma.groupMember.findFirst({
        where: {
          userId: viewerId,
          group: {
            members: {
              some: {
                userId: targetUser.id
              }
            }
          }
        }
      })
      if (sharedGroup) {
        canView = true
      }
    }

    if (!canView) {
      if (profileVisibility === 'private') {
        return NextResponse.json(
          { message: 'This profile is private' },
          { status: 403 }
        )
      } else {
        return NextResponse.json(
          { message: 'You must be a group member to view this profile' },
          { status: 403 }
        )
      }
    }

    // Feedback received (exclude flagged)
    const feedbackReceivedCount = await prisma.feedbackSubmission.count({
      where: { targetUserId: targetUser.id, isFlagged: false }
    })

    // Feedback given: count audit logs of FEEDBACK_SUBMIT by this user, excluding anonymous submissions
    const givenLogs = await prisma.auditLog.findMany({
      where: { userId: targetUser.id, action: 'FEEDBACK_SUBMIT' },
      select: { details: true }
    })
    let feedbackGivenCount = 0
    for (const log of givenLogs) {
      try {
        const d = log.details ? JSON.parse(log.details as string) : null
        if (d && d.isAnonymous === false) {
          feedbackGivenCount++
        }
      } catch {}
    }

    const userProfile = {
      id: targetUser.id,
      email: targetUser.email,
      username: targetUser.username,
      fullName: targetUser.fullName,
      createdAt: targetUser.createdAt,
      lastLoginAt: targetUser.lastLoginAt || null,
      _count: {
        feedbackGiven: feedbackGivenCount,
        feedbackReceived: feedbackReceivedCount,
        groupsCreated: targetUser._count.createdGroups,
        groupMembers: targetUser._count.groupMemberships
      }
    }

    return NextResponse.json({ user: userProfile })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
