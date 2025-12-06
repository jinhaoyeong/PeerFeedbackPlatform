import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import jwt from 'jsonwebtoken'

function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    return decoded
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const count = await NotificationService.getUnreadCount(user.userId)
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error getting unread count:', error)
    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    )
  }
}