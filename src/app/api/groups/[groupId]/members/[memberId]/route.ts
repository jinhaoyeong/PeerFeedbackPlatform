import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string, memberId: string }> }
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

    const { groupId, memberId } = await params

    // Check if current user is admin
    const currentMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id
        }
      }
    })

    if (!currentMembership || currentMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Only group admins can remove members' },
        { status: 403 }
      )
    }

    // Cannot remove yourself
    if (memberId === user.id) {
      return NextResponse.json(
        { message: 'You cannot remove yourself from the group' },
        { status: 400 }
      )
    }

    // Get member to remove
    const memberToRemove = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId
        }
      }
    })

    if (!memberToRemove) {
      return NextResponse.json(
        { message: 'Member not found' },
        { status: 404 }
      )
    }

    // Cannot remove other admins
    if (memberToRemove.role === 'ADMIN') {
      return NextResponse.json(
        { message: 'Cannot remove another admin from the group' },
        { status: 400 }
      )
    }

    // Remove member
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId
        }
      }
    })

    // Log audit event
    await AuthService.logAuditEvent(user.id, 'GROUP_MEMBER_REMOVE', 'Group', groupId, {
      removedMemberId: memberId,
      removedMemberName: memberToRemove.userId
    })

    return NextResponse.json({
      message: 'Member removed successfully'
    })

  } catch (error: any) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to remove member' },
      { status: 500 }
    )
  }
}