import { v4 as uuidv4 } from 'uuid'
import { prisma } from './prisma'
import { NotificationService } from './notifications'
import { AuthService } from './auth-service'

export interface CreateGroupData {
  name: string
  description?: string
}

export interface JoinGroupData {
  joinCode: string
}

export interface GroupMember {
  id: string
  userId: string
  groupId: string
  role: string
  canGiveFeedback: boolean
  canReceiveFeedback: boolean
  hasOptedOut: boolean
  joinedAt: Date
  user: {
    id: string
    username: string
    fullName: string
    email: string
  }
}

export interface Group {
  id: string
  name: string
  description?: string
  joinCode: string
  isActive: boolean
  defaultCanGiveFeedback: boolean
  defaultCanReceiveFeedback: boolean
  defaultCanCreateSessions: boolean
  createdAt: Date
  updatedAt: Date
  creatorId: string
  creator: {
    id: string
    username: string
    fullName: string
  }
  members: GroupMember[]
  memberCount: number
}

export class GroupService {
  static generateJoinCode(): string {
    // Generate a random 8-character join code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  static async createGroup(userId: string, data: CreateGroupData): Promise<Group> {
    try {
      // Validate input
      if (!data.name || data.name.trim().length < 2) {
        throw new Error('Group name must be at least 2 characters long')
      }

      if (data.name && data.name.length > 100) {
        throw new Error('Group name must be 100 characters or less')
      }

      if (data.description && data.description.length > 500) {
        throw new Error('Group description must be 500 characters or less')
      }

      // Generate unique join code
      let joinCode = this.generateJoinCode()
      let attempts = 0
      const maxAttempts = 10

      while (attempts < maxAttempts) {
        const existing = await prisma.group.findUnique({
          where: { joinCode }
        })

        if (!existing) break

        joinCode = this.generateJoinCode()
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique join code')
      }

      // Create group
      const group = await prisma.group.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          joinCode,
          creatorId: userId,
          defaultCanGiveFeedback: true,
          defaultCanReceiveFeedback: true,
          defaultCanCreateSessions: false
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      // Add creator as admin member
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'ADMIN',
          canGiveFeedback: true,
          canReceiveFeedback: true
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'GROUP_CREATE', 'Group', group.id, {
        name: group.name,
        joinCode
      })

      // Get updated group with members
      const groupWithMembers = await prisma.group.findUnique({
        where: { id: group.id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      return {
        ...groupWithMembers!,
        memberCount: groupWithMembers!.members.length
      }
    } catch (error: any) {
      console.error('Create group error:', error)
      throw error
    }
  }

  static async joinGroup(userId: string, data: JoinGroupData): Promise<Group> {
    try {
      if (!data.joinCode || data.joinCode.trim().length === 0) {
        throw new Error('Join code is required')
      }

      // Find group by join code
      const group = await prisma.group.findUnique({
        where: { joinCode: data.joinCode.trim().toUpperCase() }
      })

      if (!group) {
        throw new Error('Invalid join code')
      }

      if (!group.isActive) {
        throw new Error('This group is no longer active')
      }

      // Check if user is already a member
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: group.id,
            userId
          }
        }
      })

      if (existingMember) {
        throw new Error('You are already a member of this group')
      }

      // Add user as member with group's default permissions
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'MEMBER',
          canGiveFeedback: group.defaultCanGiveFeedback,
          canReceiveFeedback: group.defaultCanReceiveFeedback
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'GROUP_JOIN', 'Group', group.id, {
        groupName: group.name,
        joinCode: data.joinCode
      })

      // Return group with members
      const groupWithMembers = await prisma.group.findUnique({
        where: { id: group.id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      // Create notifications for existing members (excluding the new member)
      try {
        const others = (groupWithMembers!.members || []).filter((m: any) => m.userId !== userId)
        const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, username: true } })
        const joinerName = joiner?.fullName || 'A member'
        await Promise.all(others.map((m: any) => NotificationService.createNotification({
          userId: m.userId,
          type: 'group_invite',
          title: 'New Member Joined',
          message: `${joinerName} joined ${groupWithMembers!.name}`,
          data: { groupId: groupWithMembers!.id, joiner: { id: userId, name: joinerName } }
        })))
      } catch {}

      return {
        ...groupWithMembers!,
        memberCount: groupWithMembers!.members.length
      }
    } catch (error: any) {
      console.error('Join group error:', error)
      throw error
    }
  }

  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              creator: {
                select: {
                  id: true,
                  username: true,
                  fullName: true
                }
              },
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      fullName: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        }
      })

      return memberships.map((membership: any) => ({
        ...membership.group,
        memberCount: membership.group.members.length,
        currentUserRole: membership.role,
        members: membership.group.members
      }))
    } catch (error) {
      console.error('Get user groups error:', error)
      throw new Error('Failed to retrieve user groups')
    }
  }

  static async getGroupById(userId: string, groupId: string): Promise<Group | null> {
    try {
      // Check if user is member
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        }
      })

      if (!membership) {
        return null
      }

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            },
            orderBy: {
              joinedAt: 'asc'
            }
          }
        }
      })

      if (!group) {
        return null
      }

      return {
        ...group,
        memberCount: group.members.length
      }
    } catch (error) {
      console.error('Get group error:', error)
      throw new Error('Failed to retrieve group')
    }
  }

  static async updateMemberRole(
    userId: string,
    groupId: string,
    memberUserId: string,
    newRole: 'ADMIN' | 'MODERATOR' | 'MEMBER'
  ): Promise<GroupMember> {
    try {
      // Check if requester is admin
      const requesterMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        }
      })

      if (!requesterMembership || requesterMembership.role !== 'ADMIN') {
        throw new Error('Only group admins can update member roles')
      }

      // Don't allow admins to change their own role
      if (userId === memberUserId) {
        throw new Error('Cannot change your own role')
      }

      // Update member role
      const updatedMember = await prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId: memberUserId
          }
        },
        data: {
          role: newRole
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          }
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'MEMBER_ROLE_UPDATE', 'GroupMember', updatedMember.id, {
        groupId,
        memberUserId,
        newRole
      })

      return updatedMember
    } catch (error: any) {
      console.error('Update member role error:', error)
      throw error
    }
  }

  static async leaveGroup(userId: string, groupId: string): Promise<void> {
    try {
      // Check if user is member
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        },
        include: {
          user: {
            select: {
              fullName: true,
              username: true
            }
          }
        }
      })

      if (!membership) {
        throw new Error('You are not a member of this group')
      }

      // Don't allow creators to leave their own groups
      const group = await prisma.group.findUnique({
        where: { id: groupId }
      })

      if (group && group.creatorId === userId) {
        throw new Error('Group creators cannot leave their own groups')
      }

      // Get remaining members before removing the user
      const remainingMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: { not: userId }
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          }
        }
      })

      // Remove member
      await prisma.groupMember.delete({
        where: {
          id: membership.id
        }
      })

      // Create notifications for remaining members
      const leavingUserName = membership.user.fullName || membership.user.username || 'A member'
      try {
        await Promise.all(remainingMembers.map((member: { userId: string }) =>
          NotificationService.createNotification({
            userId: member.userId,
            type: 'group_member_left',
            title: 'Member Left Group',
            message: `${leavingUserName} left ${group?.name}`,
            data: {
              groupId,
              leavingUser: {
                id: userId,
                name: leavingUserName
              },
              groupName: group?.name
            }
          })
        ))
      } catch (notificationError) {
        console.warn('Failed to send leave notifications:', notificationError)
        // Don't fail the leave operation if notifications fail
      }

      // Log audit event
      await AuthService.logAuditEvent(userId, 'GROUP_LEAVE', 'Group', groupId, {
        groupName: group?.name,
        memberCount: remainingMembers.length
      })
    } catch (error: any) {
      console.error('Leave group error:', error)
      throw error
    }
  }

  static async updateGroupSettings(
    userId: string,
    groupId: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<Group> {
    try {
      // Check if user is admin
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can update group settings')
      }

      // Validate data
      if (data.name && (data.name.trim().length < 2 || data.name.length > 100)) {
        throw new Error('Group name must be between 2 and 100 characters')
      }

      if (data.description && data.description.length > 500) {
        throw new Error('Group description must be 500 characters or less')
      }

      // Update group
      const updatedGroup = await prisma.group.update({
        where: { id: groupId },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.description !== undefined && { description: data.description?.trim() || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive })
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'GROUP_UPDATE', 'Group', groupId, data)

      return {
        ...updatedGroup,
        memberCount: updatedGroup.members.length
      }
    } catch (error: any) {
      console.error('Update group settings error:', error)
      throw error
    }
  }

  static async deleteGroup(userId: string, groupId: string): Promise<void> {
    try {
      // Check if user is admin
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can delete groups')
      }

      // Get group details for audit log
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true }
      })

      if (!group) {
        throw new Error('Group not found')
      }

      // Delete all related data in a transaction
      await prisma.$transaction(async (tx: any) => {
        // Delete feedback submissions related to this group's sessions
        const sessions = await tx.feedbackSession.findMany({
          where: { groupId }
        })

        for (const session of sessions) {
          await tx.feedbackSubmission.deleteMany({
            where: { sessionId: session.id }
          })
        }

        // Delete all feedback sessions
        await tx.feedbackSession.deleteMany({
          where: { groupId }
        })

        // Delete all group members
        await tx.groupMember.deleteMany({
          where: { groupId }
        })

        // Delete audit events related to this group
        await tx.auditLog.deleteMany({
          where: { resourceId: groupId }
        })

        // Delete the group
        await tx.group.delete({
          where: { id: groupId }
        })
      })

      // Log audit event (this will be deleted with the group, but we log it before the transaction)
      await AuthService.logAuditEvent(userId, 'GROUP_DELETE', 'Group', groupId, {
        groupName: group.name
      })

    } catch (error: any) {
      console.error('Delete group error:', error)
      throw error
    }
  }
}
