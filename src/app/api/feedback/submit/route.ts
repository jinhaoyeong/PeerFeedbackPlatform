import { NextRequest, NextResponse } from 'next/server'
import { FeedbackService } from '@/lib/feedback-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  try {
    // For feedback submission, we allow anonymous access with a token
    // or authenticated users
    let userId: string | undefined
    let anonymousToken: string | undefined

    // Try to get authenticated user first
    const user = await getUserFromRequest(request)
    if (user) {
      userId = user.id
    }

    // Get anonymous token from header or body
    const anonToken = request.headers.get('x-anonymous-token')
    const body = await request.json()

    if (!userId && !anonToken && !body.anonymousToken) {
      return NextResponse.json(
        { message: 'Authentication or anonymous token required' },
        { status: 401 }
      )
    }

    anonymousToken = anonToken || body.anonymousToken

    const { sessionId, targetUserId, content } = body

    const submission = await FeedbackService.submitFeedback(
      userId || 'anonymous',
      { sessionId, targetUserId, content },
      anonymousToken
    )

    return NextResponse.json({
      submission,
      message: 'Feedback submitted successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Submit feedback error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to submit feedback' },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}