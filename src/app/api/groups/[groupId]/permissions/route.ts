import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth-service'

// Import socket server (commented out until socket server is implemented)
// let io: any = null
// try {
//   const socketModule = require('../../../../socket-server')
//   io = socketModule.io
// } catch {
//   // Socket server not available
// }
const io = null

export async function PUT(
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
    const body = await request.json()
    const {
      defaultCanGiveFeedback,
      defaultCanReceiveFeedback,
      defaultCanCreateSessions,
      applyToExisting
    } = body

    // Check if user is admin
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id
        }
      }
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Only group admins can update permissions' },
        { status: 403 }
      )
    }

    // Update group settings for default permissions
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        defaultCanGiveFeedback,
        defaultCanReceiveFeedback,
        defaultCanCreateSessions
      }
    })

    // If applying to existing members, update all non-admin members
    if (applyToExisting) {
      await prisma.groupMember.updateMany({
        where: {
          groupId,
          role: {
            not: 'ADMIN'
          }
        },
        data: {
          canGiveFeedback: defaultCanGiveFeedback,
          canReceiveFeedback: defaultCanReceiveFeedback
        }
      })
    }

    // Log audit event
    await AuthService.logAuditEvent(user.id, 'GROUP_PERMISSIONS_UPDATE', 'Group', groupId, {
      defaultCanGiveFeedback,
      defaultCanReceiveFeedback,
      defaultCanCreateSessions,
      applyToExisting
    })

    // Emit socket event to notify all group members
    if (io) {
      (io as any).to(groupId).emit('group_permissions_updated', {
        groupId,
        permissions: {
          defaultCanGiveFeedback,
          defaultCanReceiveFeedback,
          defaultCanCreateSessions,
          updatedBy: user.fullName
        }
      })
    }

    return NextResponse.json({
      message: 'Permissions updated successfully',
      group: updatedGroup
    })

  } catch (error: any) {
    console.error('Update permissions error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update permissions' },
      { status: 500 }
    )
  }
}