import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'

export async function PUT(
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
    const body = await request.json()
    const { role } = body

    if (!role || !['MEMBER', 'MODERATOR', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { message: 'Invalid role' },
        { status: 400 }
      )
    }

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
        { message: 'Only group admins can change roles' },
        { status: 403 }
      )
    }

    // Cannot change your own role
    if (memberId === user.id) {
      return NextResponse.json(
        { message: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    // Get member to update
    const memberToUpdate = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId
        }
      }
    })

    if (!memberToUpdate) {
      return NextResponse.json(
        { message: 'Member not found' },
        { status: 404 }
      )
    }

    // If removing admin role, ensure there's at least one admin left
    if (memberToUpdate.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.groupMember.count({
        where: {
          groupId,
          role: 'ADMIN'
        }
      })

      if (adminCount <= 1) {
        return NextResponse.json(
          { message: 'Group must have at least one admin' },
          { status: 400 }
        )
      }
    }

    // Update member role
    await prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId
        }
      },
      data: { role }
    })

    // Log audit event
    await AuthService.logAuditEvent(user.id, 'GROUP_MEMBER_ROLE_CHANGE', 'Group', groupId, {
      memberId,
      oldRole: memberToUpdate.role,
      newRole: role
    })

    return NextResponse.json({
      message: 'Role updated successfully'
    })

  } catch (error: any) {
    console.error('Update member role error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update member role' },
      { status: 500 }
    )
  }
}