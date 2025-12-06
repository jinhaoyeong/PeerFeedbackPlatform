import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(
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

    // Get session with all data
    const session = await prisma.feedbackSession.findUnique({
      where: { id: sessionId },
      include: {
        group: true,
        submissions: {
          include: {
            targetUser: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            },
            feedbackItems: {
              include: {
                category: true
              }
            }
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json(
        { message: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if user is a member of the group
    const isMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: session.groupId,
          userId: user.id
        }
      }
    })

    if (!isMember) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }

    // Generate CSV content
    const headers = ['Target User', 'Username', 'Feedback Category', 'Feedback Text', 'Rating', 'Submitted At', 'Submitted By']
    const rows = session.submissions.map((submission: any) =>
      submission.feedbackItems.map((item: any) => [
        submission.targetUser.fullName,
        `@${submission.targetUser.username}`,
        item.category?.name || 'General',
        item.text || '',
        item.rating?.toString() || '',
        item.createdAt ? new Date(item.createdAt).toISOString() : '',
        submission.submittedBy || 'Anonymous'
      ])
    ).flat()

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n')

    // Create CSV file
    const csv = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv"`
      }
    })

  } catch (error: any) {
    console.error('Export session error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to export session' },
      { status: 500 }
    )
  }
}