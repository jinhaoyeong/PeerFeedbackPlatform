import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/analytics-service'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

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
    const type = searchParams.get('type') || 'dashboard'
    const timeRange = (searchParams.get('timeRange') as 'week' | 'month' | 'quarter' | 'year') || 'month'

    if (type === 'dashboard') {
      const stats = await AnalyticsService.getDashboardStats(user.id)
      return NextResponse.json({
        stats,
        message: 'Dashboard statistics retrieved successfully'
      })
    } else if (type === 'analytics') {
      const analytics = await AnalyticsService.getAnalyticsData(user.id, timeRange)
      return NextResponse.json({
        analytics,
        message: 'Analytics data retrieved successfully'
      })
    } else {
      return NextResponse.json(
        { message: 'Invalid analytics type' },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('Get analytics error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve analytics data' },
      { status: 500 }
    )
  }
}

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
    const { event, context } = body || {}

    if (!event || typeof event !== 'string') {
      return NextResponse.json(
        { message: 'Invalid event name' },
        { status: 400 }
      )
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UI_INTERACTION',
        resource: 'Analytics',
        resourceId: event,
        details: context ? JSON.stringify(context) : null,
      }
    })

    return NextResponse.json({ message: 'Event logged' })
  } catch (error: any) {
    console.error('Analytics event log error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to log event' },
      { status: 500 }
    )
  }
}
