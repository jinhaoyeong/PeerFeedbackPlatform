import { prisma } from './prisma'

export interface FeedbackData {
  content: string
  targetUserId: string
  sessionId: string
  isAnonymous?: boolean
}

export interface FeedbackSessionData {
  name: string
  description?: string
  groupId: string
  creatorId: string
  isAnonymous: boolean
  allowAnonymousFeedback: boolean
  endDate?: Date
}

export interface Feedback {
  id: string
  content: string
  sessionId: string
  submitterId: string
  targetUserId: string
  isAnonymous: boolean
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  sentimentScore?: number
  createdAt: Date
  updatedAt: Date
  submitter?: {
    id: string
    username: string
    fullName: string
  }
  targetUser?: {
    id: string
    username: string
    fullName: string
  }
  session?: {
    id: string
    name: string
  }
}

export interface FeedbackSession {
  id: string
  name: string
  description?: string
  groupId: string
  creatorId: string
  isAnonymous: boolean
  allowAnonymousFeedback: boolean
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  endDate?: Date
  createdAt: Date
  updatedAt: Date
  _count?: {
    feedback: number
    participants: number
  }
  creator?: {
    id: string
    username: string
    fullName: string
  }
  group?: {
    id: string
    name: string
  }
}

export class FeedbackService {
  static async createFeedbackSession(data: FeedbackSessionData): Promise<FeedbackSession> {
    try {
      const session = await prisma.feedbackSession.create({
        data: {
          name: data.name,
          description: data.description,
          groupId: data.groupId,
          creatorId: data.creatorId,
          isAnonymous: data.isAnonymous,
          allowAnonymousFeedback: data.allowAnonymousFeedback,
          endDate: data.endDate,
          status: 'DRAFT',
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              feedback: true,
              participants: true,
            },
          },
        },
      })

      return session
    } catch (error) {
      console.error('Error creating feedback session:', error)
      throw new Error('Failed to create feedback session')
    }
  }

  static async submitFeedback(data: FeedbackData): Promise<Feedback> {
    try {
      // Import sentiment for analysis
      const sentiment = require('sentiment')
      const sentimentAnalyzer = new sentiment()

      // Analyze sentiment
      const sentimentResult = sentimentAnalyzer.analyze(data.content)
      let sentimentType: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL'

      if (sentimentResult.score > 0) {
        sentimentType = 'POSITIVE'
      } else if (sentimentResult.score < 0) {
        sentimentType = 'NEGATIVE'
      }

      const feedback = await prisma.feedback.create({
        data: {
          content: data.content,
          sessionId: data.sessionId,
          submitterId: data.targetUserId, // In a real implementation, this should be the actual submitter ID
          targetUserId: data.targetUserId,
          isAnonymous: data.isAnonymous || false,
          sentiment: sentimentType,
          sentimentScore: sentimentResult.score,
        },
        include: {
          submitter: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          session: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return feedback
    } catch (error) {
      console.error('Error submitting feedback:', error)
      throw new Error('Failed to submit feedback')
    }
  }

  static async getFeedbackForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Feedback[]> {
    try {
      const feedback = await prisma.feedback.findMany({
        where: {
          targetUserId: userId,
        },
        include: {
          submitter: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          session: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      })

      return feedback
    } catch (error) {
      console.error('Error getting feedback for user:', error)
      return []
    }
  }

  static async getSessionFeedback(
    sessionId: string,
    userId?: string
  ): Promise<Feedback[]> {
    try {
      // Check if user has access to this session
      if (userId) {
        const session = await prisma.feedbackSession.findUnique({
          where: { id: sessionId },
          include: {
            group: {
              include: {
                members: {
                  where: {
                    userId,
                  },
                },
              },
            },
          },
        })

        if (!session || session.group.members.length === 0) {
          throw new Error('Access denied')
        }
      }

      const feedback = await prisma.feedback.findMany({
        where: {
          sessionId,
        },
        include: {
          submitter: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          session: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return feedback
    } catch (error) {
      console.error('Error getting session feedback:', error)
      throw error
    }
  }

  static async getUserSessions(
    userId: string,
    status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  ): Promise<FeedbackSession[]> {
    try {
      const whereClause: any = {
        group: {
          members: {
            some: {
              userId,
            },
          },
        },
      }

      if (status) {
        whereClause.status = status
      }

      const sessions = await prisma.feedbackSession.findMany({
        where: whereClause,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              feedback: true,
              participants: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return sessions
    } catch (error) {
      console.error('Error getting user sessions:', error)
      return []
    }
  }

  static async updateSessionStatus(
    sessionId: string,
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
    userId: string
  ): Promise<FeedbackSession> {
    try {
      // Check if user is the session creator or group admin
      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: {
          group: {
            include: {
              members: {
                where: {
                  userId,
                  role: 'ADMIN',
                },
              },
            },
          },
        },
      })

      if (!session || (session.creatorId !== userId && session.group.members.length === 0)) {
        throw new Error('Access denied')
      }

      const updatedSession = await prisma.feedbackSession.update({
        where: { id: sessionId },
        data: { status },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              feedback: true,
              participants: true,
            },
          },
        },
      })

      return updatedSession
    } catch (error) {
      console.error('Error updating session status:', error)
      throw error
    }
  }

  static async deleteFeedback(feedbackId: string, userId: string): Promise<void> {
    try {
      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
      })

      if (!feedback) {
        throw new Error('Feedback not found')
      }

      // Check if user is the feedback submitter, target, or session creator/group admin
      const session = await prisma.feedbackSession.findUnique({
        where: { id: feedback.sessionId },
        include: {
          group: {
            include: {
              members: {
                where: {
                  userId,
                  role: 'ADMIN',
                },
              },
            },
          },
        },
      })

      if (
        feedback.submitterId !== userId &&
        feedback.targetUserId !== userId &&
        session?.creatorId !== userId &&
        session?.group.members.length === 0
      ) {
        throw new Error('Access denied')
      }

      await prisma.feedback.delete({
        where: { id: feedbackId },
      })
    } catch (error) {
      console.error('Error deleting feedback:', error)
      throw error
    }
  }

  static async getFeedbackAnalytics(userId: string, sessionId?: string): Promise<any> {
    try {
      let whereClause: any = {
        targetUserId: userId,
      }

      if (sessionId) {
        whereClause.sessionId = sessionId
      }

      const feedback = await prisma.feedback.findMany({
        where: whereClause,
        select: {
          sentiment: true,
          sentimentScore: true,
          createdAt: true,
        },
      })

      const totalFeedback = feedback.length
      const positiveFeedback = feedback.filter((f: any) => f.sentiment === 'POSITIVE').length
      const negativeFeedback = feedback.filter((f: any) => f.sentiment === 'NEGATIVE').length
      const neutralFeedback = feedback.filter((f: any) => f.sentiment === 'NEUTRAL').length

      const averageSentiment = totalFeedback > 0
        ? feedback.reduce((sum: number, f: any) => sum + (f.sentimentScore || 0), 0) / totalFeedback
        : 0

      // Group by month for timeline
      const monthlyData = feedback.reduce((acc: any, f: any) => {
        const month = new Date(f.createdAt).toISOString().slice(0, 7)
        if (!acc[month]) {
          acc[month] = { positive: 0, negative: 0, neutral: 0, total: 0 }
        }
        acc[month][f.sentiment.toLowerCase()]++
        acc[month].total++
        return acc
      }, {})

      return {
        totalFeedback,
        positiveFeedback,
        negativeFeedback,
        neutralFeedback,
        averageSentiment: Math.round(averageSentiment * 100) / 100,
        monthlyData,
      }
    } catch (error) {
      console.error('Error getting feedback analytics:', error)
      return {
        totalFeedback: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
        neutralFeedback: 0,
        averageSentiment: 0,
        monthlyData: {},
      }
    }
  }
}