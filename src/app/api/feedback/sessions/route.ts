import { NextRequest, NextResponse } from 'next/server'
import { FeedbackService } from '@/lib/feedback-service'
import { NotificationService } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { groupId, title, description, startsAt, endsAt, allowSelfFeedback, allowAnonymousFeedback, notifyOnCreate } = body

    const session = await FeedbackService.createSession(user.id, {
      groupId,
      title,
      description,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      allowSelfFeedback,
      allowAnonymousFeedback
    })

    if (notifyOnCreate) {
      try {
        const members = await prisma.groupMember.findMany({
          where: { groupId },
          include: { user: { select: { id: true, fullName: true } } }
        })
        const creatorName = user.fullName || user.username || 'Group Admin'
        await Promise.all(
          (members || [])
            .filter((m: any) => m.userId !== user.id)
            .map((m: any) => NotificationService.notifySessionInvitation(m.user.id, title, creatorName))
        )
      } catch (e) {
        console.error('Failed to send session creation notifications:', e)
      }
    }

    return NextResponse.json({
      session,
      message: 'Feedback session created successfully'
    }, { status: 201 })
  } catch (error: any) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create feedback session' },
      { status: 400 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json(
        { message: 'Group ID is required' },
        { status: 400 }
      )
    }

    const sessions = await FeedbackService.getGroupSessions(user.id, groupId)

    return NextResponse.json({
      sessions,
      message: 'Sessions retrieved successfully'
    })
  } catch (error: any) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve feedback sessions' },
      { status: 500 }
    )
  }
}
