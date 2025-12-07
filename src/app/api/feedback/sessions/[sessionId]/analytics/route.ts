import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/analytics-service'
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

    const analytics = await AnalyticsService.getSessionAnalytics(user.id, sessionId)

    return NextResponse.json({
      analytics,
      message: 'Session analytics retrieved successfully'
    })
  } catch (error: any) {
    console.error('Get session analytics error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve session analytics' },
      { status: 500 }
    )
  }
}
