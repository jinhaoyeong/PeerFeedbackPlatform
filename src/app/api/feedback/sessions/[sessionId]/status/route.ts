import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { FeedbackService } from '@/lib/feedback-service'

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

    // Validate sessionId exists
    if (!sessionId) {
      return NextResponse.json(
        { message: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Parse request body with error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      )
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

    const session = await FeedbackService.updateSessionStatus(
      user.id,
      sessionId,
      status
    )

    return NextResponse.json({
      session,
      message: 'Session status updated successfully'
    })

  } catch (error: any) {
    console.error('Update session status error:', error)

    // Ensure we always return JSON with proper error message
    const errorMessage = error?.message || 'Failed to update session status'

    return NextResponse.json(
      { message: errorMessage },
      { status: 400 }
    )
  }
}
