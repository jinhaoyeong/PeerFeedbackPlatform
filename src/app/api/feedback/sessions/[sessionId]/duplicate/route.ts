import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    // Get original session
    const originalSession = await prisma.feedbackSession.findUnique({
      where: { id: sessionId },
      include: {
        group: {
          include: {
            members: {
              where: { userId: user.id }
            }
          }
        }
      }
    })

    if (!originalSession) {
      return NextResponse.json(
        { message: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if user is admin or moderator of the group
    const memberRole = originalSession.group.members[0]?.role
    if (!['ADMIN', 'MODERATOR'].includes(memberRole || '')) {
      return NextResponse.json(
        { message: 'Only admins or moderators can duplicate sessions' },
        { status: 403 }
      )
    }

    // Create duplicate session
    const duplicatedSession = await prisma.feedbackSession.create({
      data: {
        title: `${originalSession.title} (Copy)`,
        description: originalSession.description,
        groupId: originalSession.groupId,
        status: 'DRAFT',
        allowSelfFeedback: originalSession.allowSelfFeedback,
        allowAnonymousFeedback: (originalSession as any).allowAnonymousFeedback ?? true,
        startsAt: null,
        endsAt: null
      }
    })

    // Log audit event
    await AuthService.logAuditEvent(user.id, 'SESSION_DUPLICATE', 'FeedbackSession', duplicatedSession.id, {
      originalSessionId: sessionId,
      groupId: originalSession.groupId
    })

    return NextResponse.json({
      session: duplicatedSession,
      message: 'Session duplicated successfully'
    })

  } catch (error: any) {
    console.error('Duplicate session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to duplicate session' },
      { status: 500 }
    )
  }
}
