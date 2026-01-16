import { NextRequest, NextResponse } from 'next/server'
import { GroupService } from '@/lib/group-service'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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

    const { groupId } = await params

    // Get group to check if user is admin
    const group = await GroupService.getGroupById(user.id, groupId)
    if (!group) {
      return NextResponse.json(
        { message: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is admin
    const member = group.members.find(m => m.user.id === user.id)
    if (member?.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Only group admins can regenerate join codes' },
        { status: 403 }
      )
    }

    // Generate unique join code
    let joinCode = GroupService.generateJoinCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const existing = await prisma.group.findUnique({
        where: { joinCode }
      })

      if (!existing || existing.id === groupId) break

      joinCode = GroupService.generateJoinCode()
      attempts++
    }

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique join code')
    }

    // Update group with new join code
    await prisma.group.update({
      where: { id: groupId },
      data: { joinCode }
    })

    // Log audit event
    await AuthService.logAuditEvent(user.id, 'GROUP_REGENERATE_CODE', 'Group', groupId, {
      groupName: group.name,
      newJoinCode: joinCode
    })

    return NextResponse.json({
      joinCode,
      message: 'Join code regenerated successfully'
    })

  } catch (error: any) {
    console.error('Regenerate join code error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to regenerate join code' },
      { status: 500 }
    )
  }
}