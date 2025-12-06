import { prisma } from './prisma'
import { v4 as uuidv4 } from 'uuid'

export interface GroupData {
  name: string
  description?: string
  creatorId: string
  isAnonymous?: boolean
}

export interface Group {
  id: string
  name: string
  description?: string
  creatorId: string
  isAnonymous: boolean
  inviteCode: string
  createdAt: Date
  updatedAt: Date
  _count?: {
    members: number
    feedbackSessions: number
  }
  creator?: {
    id: string
    username: string
    fullName: string
  }
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER'
  joinedAt: Date
  user?: {
    id: string
    username: string
    fullName: string
    email: string
  }
}

export class GroupsService {
  static async createGroup(data: GroupData): Promise<Group> {
    try {
      const inviteCode = this.generateInviteCode()

      const group = await prisma.group.create({
        data: {
          name: data.name,
          description: data.description,
          creatorId: data.creatorId,
          isAnonymous: data.isAnonymous || false,
          inviteCode,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              members: true,
              feedbackSessions: true,
            },
          },
        },
      })

      // Add creator as admin member
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: data.creatorId,
          role: 'ADMIN',
        },
      })

      return group
    } catch (error) {
      console.error('Error creating group:', error)
      throw new Error('Failed to create group')
    }
  }

  static async joinGroup(groupId: string, userId: string): Promise<GroupMember> {
    try {
      // Check if user is already a member
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      })

      if (existingMember) {
        throw new Error('User is already a member of this group')
      }

      const group = await prisma.group.findUnique({
        where: { id: groupId },
      })

      if (!group) {
        throw new Error('Group not found')
      }

      const member = await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          role: 'MEMBER',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
        },
      })

      return member
    } catch (error) {
      console.error('Error joining group:', error)
      throw error
    }
  }

  static async joinGroupByInviteCode(inviteCode: string, userId: string): Promise<GroupMember> {
    try {
      const group = await prisma.group.findUnique({
        where: { inviteCode },
      })

      if (!group) {
        throw new Error('Invalid invite code')
      }

      return this.joinGroup(group.id, userId)
    } catch (error) {
      console.error('Error joining group by invite code:', error)
      throw error
    }
  }

  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              members: true,
              feedbackSessions: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      })

      return groups
    } catch (error) {
      console.error('Error getting user groups:', error)
      return []
    }
  }

  static async getGroupDetails(groupId: string, userId?: string): Promise<Group | null> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              members: true,
              feedbackSessions: true,
            },
          },
        },
      })

      // Check if user is a member (if userId provided)
      if (userId && group) {
        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        })

        if (!membership) {
          return null
        }
      }

      return group
    } catch (error) {
      console.error('Error getting group details:', error)
      return null
    }
  }

  static async getGroupMembers(groupId: string, userId?: string): Promise<GroupMember[]> {
    try {
      // Check if requesting user is a member
      if (userId) {
        const membership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        })

        if (!membership) {
          throw new Error('Access denied')
        }
      }

      const members = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' },
        ],
      })

      return members
    } catch (error) {
      console.error('Error getting group members:', error)
      throw error
    }
  }

  static async updateMemberRole(
    groupId: string,
    userId: string,
    newRole: 'ADMIN' | 'MODERATOR' | 'MEMBER',
    requestingUserId: string
  ): Promise<void> {
    try {
      // Check if requester is admin
      const requesterMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: requestingUserId,
          },
        },
      })

      if (!requesterMembership || requesterMembership.role !== 'ADMIN') {
        throw new Error('Only admins can update member roles')
      }

      // Don't allow changing the creator's role
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      })

      if (group?.creatorId === userId) {
        throw new Error('Cannot change the group creator\'s role')
      }

      await prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        data: { role: newRole },
      })
    } catch (error) {
      console.error('Error updating member role:', error)
      throw error
    }
  }

  static async leaveGroup(groupId: string, userId: string): Promise<void> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      })

      // Don't allow creator to leave their own group
      if (group?.creatorId === userId) {
        throw new Error('Group creators cannot leave their own group')
      }

      await prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      })
    } catch (error) {
      console.error('Error leaving group:', error)
      throw error
    }
  }

  private static generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}