import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

async function getAllowMessaging(userId: string): Promise<boolean> {
  try {
    const latest = await (prisma as any).auditLog.findFirst({
      where: { userId, action: 'USER_SETTINGS' },
      orderBy: { occurredAt: 'desc' }
    })
    let stored: any = null
    try { stored = latest?.details ? JSON.parse(latest.details as any) : null } catch {}
    return typeof stored?.allowMessaging === 'undefined' ? true : !!stored?.allowMessaging
  } catch {
    return true
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(request.url)
    const withUserId = url.searchParams.get('withUserId') || ''
    if (!withUserId) {
      return NextResponse.json({ messages: [] })
    }

    const messages = await (prisma as any).directMessage.findMany({
      where: {
        OR: [
          { senderId: user.id, recipientId: withUserId },
          { senderId: withUserId, recipientId: user.id }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: 200
    })

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('Messages GET error:', error)
    return NextResponse.json({ message: 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const toUserId = String(body.toUserId || '')
    const content = String(body.content || '').trim()
    if (!toUserId || !content) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 })
    }

    const allowed = await getAllowMessaging(toUserId)
    if (!allowed) {
      return NextResponse.json({ message: 'Recipient has disabled messaging' }, { status: 403 })
    }

    const message = await (prisma as any).directMessage.create({
      data: { senderId: user.id, recipientId: toUserId, content }
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error: any) {
    console.error('Messages POST error:', error)
    return NextResponse.json({ message: 'Failed to send message' }, { status: 500 })
  }
}

export async function PUT() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 })
}
