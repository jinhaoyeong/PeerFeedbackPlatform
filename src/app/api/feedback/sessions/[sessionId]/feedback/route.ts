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

    if (!sessionId) {
      return NextResponse.json(
        { message: 'Session ID is required' },
        { status: 400 }
      )
    }

    const feedback = await FeedbackService.getSessionFeedback(user.id, sessionId)

    return NextResponse.json({
      feedback,
      message: 'Feedback retrieved successfully'
    })

  } catch (error: any) {
    console.error('Get session feedback error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve feedback' },
      { status: 500 }
    )
  }
}
