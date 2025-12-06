import { NextRequest, NextResponse } from 'next/server'
import { FeedbackService } from '@/lib/feedback-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { userId } = await params

    const feedback = await FeedbackService.getUserFeedback(user.id, userId)

    return NextResponse.json({
      feedback,
      message: 'User feedback retrieved successfully'
    })

  } catch (error: any) {
    console.error('Get user feedback error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve user feedback' },
      { status: 500 }
    )
  }
}