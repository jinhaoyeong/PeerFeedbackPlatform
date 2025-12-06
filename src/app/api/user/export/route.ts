import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { NotificationService } from '@/lib/notifications'

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

async function compileUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      createdAt: true,
      updatedAt: true,
    }
  })

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, name: true, createdAt: true }
  })

  const feedbackReceived = await prisma.feedbackSubmission.findMany({
    where: { targetUserId: userId },
    select: { id: true, content: true, sentiment: true, submittedAt: true }
  })

  const logs = await prisma.auditLog.findMany({
    where: { userId },
    select: { id: true, action: true, resource: true, resourceId: true, occurredAt: true }
  })

  const json = {
    profile: user,
    groups,
    activityHistory: logs,
    feedbackReceived,
    preferences: {},
  }

  const rows: string[] = []
  rows.push('section,key,value')
  if (user) {
    rows.push(`profile,email,${user.email}`)
    rows.push(`profile,username,${user.username}`)
    rows.push(`profile,fullName,${user.fullName}`)
    rows.push(`profile,createdAt,${user.createdAt.toISOString()}`)
  }
  groups.forEach((g: any) => rows.push(`group,name,${g.name}`))
  feedbackReceived.forEach((f: any) => rows.push(`feedback,content,${(f.content || '').replace(/\n/g, ' ')}`))
  logs.forEach((l: any) => rows.push(`activity,${l.action},${l.occurredAt.toISOString()}`))
  const csv = rows.join('\n')

  return { json, csv }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'json').toLowerCase()
    const download = searchParams.get('download') === 'true'
    const { json, csv } = await compileUserData(user.userId)

    if (format === 'csv') {
      const headers: Record<string, string> = { 'Content-Type': 'text/csv; charset=utf-8' }
      if (download) headers['Content-Disposition'] = 'attachment; filename="export.csv"'
      return new NextResponse(csv, { status: 200, headers })
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (download) headers['Content-Disposition'] = 'attachment; filename="export.json"'
    return new NextResponse(JSON.stringify(json), { status: 200, headers })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await NotificationService.createNotification({
      userId: user.userId,
      type: 'system',
      title: 'Your data export is ready',
      message: 'Download your export in JSON or CSV format.',
      data: {
        jsonUrl: '/api/user/export?format=json&download=true',
        csvUrl: '/api/user/export?format=csv&download=true'
      }
    })

    return NextResponse.json({
      status: 'complete',
      jsonUrl: '/api/user/export?format=json&download=true',
      csvUrl: '/api/user/export?format=csv&download=true'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start export' }, { status: 500 })
  }
}

