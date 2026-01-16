import { NextRequest, NextResponse } from 'next/server'
import { FeedbackService } from '@/lib/feedback-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    const session = await FeedbackService.getSessionById(user.id, sessionId)

    if (!session) {
      return NextResponse.json(
        { message: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      session,
      message: 'Session retrieved successfully'
    })

  } catch (error: any) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve session' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { message: 'Session ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const updateKeys = ['title','description','startsAt','endsAt','allowSelfFeedback','allowAnonymousFeedback']
    const hasDetailUpdates = updateKeys.some(k => typeof (body as any)[k] !== 'undefined')

    if (hasDetailUpdates) {
      const session = await FeedbackService.updateSession(user.id, sessionId, body)
      return NextResponse.json({
        session,
        message: 'Session updated successfully'
      })
    }

    const { status } = body
    if (!status) {
      return NextResponse.json(
        { message: 'Status is required' },
        { status: 400 }
      )
    }
    if (!['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status)) {
      return NextResponse.json(
        { message: 'Invalid status value' },
        { status: 400 }
      )
    }

    const session = await FeedbackService.updateSessionStatus(user.id, sessionId, status)
    return NextResponse.json({
      session,
      message: 'Session status updated successfully'
    })
  } catch (error: any) {
    console.error('Update session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update session' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { message: 'Session ID is required' },
        { status: 400 }
      )
    }

    await FeedbackService.deleteSession(user.id, sessionId)

    return NextResponse.json({
      message: 'Session deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete session' },
      { status: 400 }
    )
  }
}
