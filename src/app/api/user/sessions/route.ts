import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        userId: user.userId,
        action: { in: ['USER_LOGIN', 'USER_LOGOUT'] }
      },
      orderBy: { occurredAt: 'desc' },
      take: 50
    })

    const events = logs.map((log: any) => {
      let details: any = null
      try { details = log.details ? JSON.parse(log.details as string) : null } catch {}
      return {
        id: log.id,
        action: log.action,
        occurredAt: log.occurredAt,
        details
      }
    })

    return NextResponse.json({ events })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
