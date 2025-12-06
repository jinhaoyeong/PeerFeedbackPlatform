import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { FeedbackService } from '@/lib/feedback-service'
import { prisma } from '@/lib/prisma'

export async function PUT(
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
    const body = await request.json()
    const { endsAt } = body

    // Validate that the user is an admin of the group
    const session = await prisma.feedbackSession.findUnique({
      where: { id: sessionId },
      include: { group: true }
    })

    if (!session) {
      return NextResponse.json(
        { message: 'Session not found' },
        { status: 404 }
      )
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: session.groupId,
          userId: user.id
        }
      }
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Only group admins can extend session time' },
        { status: 403 }
      )
    }

    // Update the session end time
    const updatedSession = await prisma.feedbackSession.update({
      where: { id: sessionId },
      data: {
        endsAt: endsAt ? new Date(endsAt) : null,
        status: 'ACTIVE' // Ensure session is active
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        },
        submissions: {
          include: {
            targetUser: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      session: {
        ...updatedSession,
        submissionCount: updatedSession.submissions.length
      },
      message: 'Session time extended successfully'
    })

  } catch (error: any) {
    console.error('Extend session time error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to extend session time' },
      { status: 400 }
    )
  }
}