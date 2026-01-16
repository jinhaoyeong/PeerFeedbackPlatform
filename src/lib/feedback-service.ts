import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import Sentiment from 'sentiment'
import { prisma } from './prisma'
import { AuthService } from './auth-service'

const sentiment = new Sentiment()
const HF_MODEL = process.env.HF_SENTIMENT_MODEL || 'cardiffnlp/twitter-roberta-base-sentiment-latest'
const HF_ENDPOINT = process.env.HF_API_URL || `https://api-inference.huggingface.co/models/${HF_MODEL}`
const HF_TOKEN = process.env.HUGGING_FACE_API_TOKEN || process.env.HF_TOKEN || ''

export interface CreateSessionData {
  groupId: string
  title: string
  description?: string
  startsAt?: Date
  endsAt?: Date
  allowSelfFeedback?: boolean
  allowAnonymousFeedback?: boolean
}

export interface SubmitFeedbackData {
  sessionId: string
  targetUserId: string
  content: string
}

export interface FeedbackSubmission {
  id: string
  sessionId: string
  targetUserId: string
  content: string
  sentiment?: string
  isFlagged: boolean
  flagReason?: string
  submittedAt: Date
  targetUser: {
    id: string
    username: string
    fullName: string
  }
}

export interface FeedbackSession {
  id: string
  groupId: string
  title: string
  description?: string
  status: string
  startsAt?: Date
  endsAt?: Date
  allowSelfFeedback: boolean
  createdAt: Date
  updatedAt: Date
  group: {
    id: string
    name: string
  }
  submissions: FeedbackSubmission[]
  submissionCount: number
}

export class FeedbackService {
  static generateAnonymousToken(): string {
    return uuidv4()
  }

  static generateSubmitterHash(token: string, sessionId: string, targetUserId: string): string {
    const combined = `${token}-${sessionId}-${targetUserId}`
    return crypto.createHash('sha256').update(combined).digest('hex')
  }

  static async analyzeSentiment(content: string): Promise<{ score: number; sentiment: string }> {
    const text = String(content || '')
    if (HF_TOKEN) {
      try {
        const res = await fetch(HF_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
        })
        if (res.ok) {
          const data = await res.json()
          const arr = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : Array.isArray(data) ? data : []
          const byLabel: Record<string, number> = {}
          for (const item of arr as Array<{ label: string; score: number }>) {
            if (!item || typeof item.label !== 'string') continue
            byLabel[item.label.toLowerCase()] = item.score
          }
          const pos = byLabel['positive'] || byLabel['pos'] || 0
          const neg = byLabel['negative'] || byLabel['neg'] || 0
          const neu = byLabel['neutral'] || byLabel['neu'] || 0
          let level = 'NEUTRAL'
          if (pos >= 0.85) level = 'VERY_POSITIVE'
          else if (neg >= 0.85) level = 'VERY_NEGATIVE'
          else if (pos >= 0.6) level = 'POSITIVE'
          else if (neg >= 0.6) level = 'NEGATIVE'
          else if (neu >= 0.5) level = 'NEUTRAL'
          const score = pos - neg
          return { score, sentiment: level }
        }
      } catch {}
    }
    const result = sentiment.analyze(text)
    let level: string
    if (result.score >= 2) {
      level = 'VERY_POSITIVE'
    } else if (result.score >= 1) {
      level = 'POSITIVE'
    } else if (result.score > -1) {
      level = 'NEUTRAL'
    } else if (result.score > -2) {
      level = 'NEGATIVE'
    } else {
      level = 'VERY_NEGATIVE'
    }
    return { score: result.score, sentiment: level }
  }

  static flagInappropriateContent(content: string): { isFlagged: boolean; reason?: string } {
    const text = String(content || '')
    const inappropriatePatterns = [
      /\b(hate|kill|die|stupid|idiot|retard)\b/gi,
      /\b(fuck|shit|damn|bitch|asshole)\b/gi
    ]

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(text)) {
        return { isFlagged: true, reason: 'INAPPROPRIATE_LANGUAGE' }
      }
    }

    if (text.length >= 700) {
      return { isFlagged: false }
    }

    const spamPatterns = [
      /([-_*~.!?])\1{9,}/,
      /\s{10,}/
    ]

    for (const pattern of spamPatterns) {
      if (pattern.test(text)) {
        return { isFlagged: true, reason: 'SPAM' }
      }
    }

    return { isFlagged: false }
  }

  static async createSession(userId: string, data: CreateSessionData): Promise<FeedbackSession> {
    try {
      // Validate user is admin of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: data.groupId,
            userId
          }
        }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can create feedback sessions')
      }

      // Require at least 3 members in the group to create a session
      const membersCount = await prisma.groupMember.count({
        where: { groupId: data.groupId }
      })
      if (membersCount < 3) {
        throw new Error('At least 3 group members are required to create a session')
      }

      // Validate input
      if (!data.title || data.title.trim().length < 3) {
        throw new Error('Session title must be at least 3 characters long')
      }

      if (data.title.length > 200) {
        throw new Error('Session title must be 200 characters or less')
      }

      if (data.description && data.description.length > 1000) {
        throw new Error('Session description must be 1000 characters or less')
      }

      // Validate dates
      if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt) {
        throw new Error('Start time must be before end time')
      }

      // Create session
      const session = await prisma.feedbackSession.create({
        data: {
          groupId: data.groupId,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          status: 'DRAFT',
          startsAt: data.startsAt || null,
          endsAt: data.endsAt || null,
          allowSelfFeedback: data.allowSelfFeedback || false,
          allowAnonymousFeedback: typeof data.allowAnonymousFeedback === 'boolean' ? data.allowAnonymousFeedback : true
        },
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          },
          submissions: {
            include: {
              targetUser: {
                select: {
                  id: true,
                  username: true,
                  fullName: true
                }
              }
            }
          }
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'SESSION_CREATE', 'FeedbackSession', session.id, {
        groupId: data.groupId,
        title: data.title
      })

      return {
        ...session,
        submissionCount: session.submissions.length
      }
    } catch (error: any) {
      console.error('Create session error:', error)
      throw error
    }
  }

  static async getGroupSessions(userId: string, groupId: string): Promise<FeedbackSession[]> {
    try {
      // Check if user is member of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        }
      })

      if (!membership) {
        throw new Error('You are not a member of this group')
      }

      const sessions = await prisma.feedbackSession.findMany({
        where: { groupId },
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          },
          submissions: {
            include: {
              targetUser: {
                select: {
                  id: true,
                  username: true,
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return sessions.map((session: any) => ({
        ...session,
        submissionCount: session.submissions.length,
        settings: {
          allowAnonymous: session.allowAnonymousFeedback === false ? false : true,
          minFeedbackLength: 50,
          maxFeedbackLength: 2500,
          autoClose: false,
          reminderFrequency: 'none' as const
        }
      }))
    } catch (error) {
      console.error('Get group sessions error:', error)
      throw new Error('Failed to retrieve feedback sessions')
    }
  }

  static async getSessionById(userId: string, sessionId: string): Promise<FeedbackSession | null> {
    try {
      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              creatorId: true
            }
          },
          submissions: {
            include: {
              targetUser: {
                select: {
                  id: true,
                  username: true,
                  fullName: true
                }
              }
            }
          }
        }
      })

      if (!session) {
        return null
      }

      // Check if user is member of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: session.groupId,
            userId
          }
        }
      })

      if (!membership) {
        // Allow access for group creator even if membership record is missing
        if ((session as any)?.group?.creatorId !== userId) {
          return null
        }
      }

      return {
        ...session,
        submissionCount: session.submissions.length,
        settings: {
          allowAnonymous: (session as any).allowAnonymousFeedback === false ? false : true,
          minFeedbackLength: 50,
          maxFeedbackLength: 2500,
          autoClose: false,
          reminderFrequency: 'none' as const
        }
      }
    } catch (error) {
      console.error('Get session error:', error)
      throw new Error('Failed to retrieve feedback session')
    }
  }

  static async submitFeedback(
    userId: string,
    data: SubmitFeedbackData,
    anonymousToken?: string
  ): Promise<FeedbackSubmission> {
    try {
      // Validate session exists and user has access
      const session = await prisma.feedbackSession.findUnique({
        where: { id: data.sessionId },
        include: {
          group: true
        }
      })

      if (!session) {
        throw new Error('Feedback session not found')
      }

      // Check if session is active
      if (session.status !== 'ACTIVE') {
        throw new Error('This feedback session is not currently active')
      }

      if ((session as any).allowAnonymousFeedback === false) {
        if (!userId || userId === 'anonymous') {
          throw new Error('Authentication required to submit non-anonymous feedback')
        }
      }

      // Check time constraints
      const now = new Date()
      if (session.startsAt && now < session.startsAt) {
        throw new Error('This feedback session has not started yet')
      }

      if (session.endsAt && now > session.endsAt) {
        throw new Error('This feedback session has ended')
      }

      // Check if user is member of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: session.groupId,
            userId
          }
        }
      })

      if (!membership || !membership.canGiveFeedback) {
        throw new Error('You do not have permission to give feedback in this group')
      }

      // Check if target user can receive feedback
      const targetMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: session.groupId,
            userId: data.targetUserId
          }
        }
      })

      if (!targetMembership || !targetMembership.canReceiveFeedback || targetMembership.hasOptedOut) {
        throw new Error('This user cannot receive feedback at this time')
      }

      // Validate feedback content
      if (!data.content || data.content.trim().length < 10) {
        throw new Error('Feedback must be at least 10 characters long')
      }

      if (data.content.length > 2500) {
        throw new Error('Feedback must be 2500 characters or less')
      }

      // Generate anonymous identifiers
      const submitterToken = anonymousToken || this.generateAnonymousToken()
      const submitterHash = this.generateSubmitterHash(submitterToken, data.sessionId, data.targetUserId)

      // Check for duplicate submission
      const existingSubmission = await prisma.feedbackSubmission.findUnique({
        where: {
          sessionId_targetUserId_submitterHash: {
            sessionId: data.sessionId,
            targetUserId: data.targetUserId,
            submitterHash
          }
        }
      })

      if (existingSubmission) {
        throw new Error('You have already submitted feedback for this person in this session')
      }

      const sentimentAnalysis = await this.analyzeSentiment(data.content)
      const contentFlag = this.flagInappropriateContent(data.content)

      // Create submission
      const submission = await prisma.feedbackSubmission.create({
        data: {
          sessionId: data.sessionId,
          targetUserId: data.targetUserId,
          content: data.content.trim(),
          sentiment: sentimentAnalysis.sentiment,
          isFlagged: contentFlag.isFlagged,
          flagReason: contentFlag.reason,
          submitterToken,
          submitterHash,
          isAnonymous: (session as any).allowAnonymousFeedback !== false,
          submitterId: (session as any).allowAnonymousFeedback === false ? userId : null,
          ipAddress: null, // We'll handle this in middleware
          userAgent: null // We'll handle this in middleware
        },
        include: {
          targetUser: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      })

      // Update feedback aggregation
      await this.updateFeedbackAggregation(data.targetUserId)

      // Log audit event (without revealing the submitter)
      await AuthService.logAuditEvent(userId, 'FEEDBACK_SUBMIT', 'FeedbackSubmission', submission.id, {
        sessionId: data.sessionId,
        targetUserId: data.targetUserId,
        isAnonymous: (session as any).allowAnonymousFeedback !== false
      })

      return submission
    } catch (error: any) {
      console.error('Submit feedback error:', error)
      throw error
    }
  }

  static async updateFeedbackAggregation(userId: string): Promise<void> {
    try {
      // Get all feedback for this user
      const submissions = await prisma.feedbackSubmission.findMany({
        where: { targetUserId: userId }
      })

      // Calculate metrics
      const totalFeedback = submissions.length
      const sentiments = submissions
        .filter((s: any) => s.sentiment && !s.isFlagged)
        .map((s: any) => s.sentiment)

      let averageSentiment = 'NEUTRAL'
      if (sentiments.length > 0) {
        const sentimentScores = {
          'VERY_NEGATIVE': -2,
          'NEGATIVE': -1,
          'NEUTRAL': 0,
          'POSITIVE': 1,
          'VERY_POSITIVE': 2
        }

        const avgScore = sentiments.reduce((sum: number, sentiment: string) =>
          sum + (sentimentScores[sentiment as keyof typeof sentimentScores] || 0), 0
        ) / sentiments.length

        if (avgScore >= 1.5) averageSentiment = 'VERY_POSITIVE'
        else if (avgScore >= 0.5) averageSentiment = 'POSITIVE'
        else if (avgScore >= -0.5) averageSentiment = 'NEUTRAL'
        else if (avgScore >= -1.5) averageSentiment = 'NEGATIVE'
        else averageSentiment = 'VERY_NEGATIVE'
      }

      // Update or create aggregation
      await prisma.feedbackAggregation.upsert({
        where: { userId },
        update: {
          totalFeedbackReceived: totalFeedback,
          averageSentiment,
          lastFeedbackAt: new Date()
        },
        create: {
          userId,
          totalFeedbackReceived: totalFeedback,
          averageSentiment,
          lastFeedbackAt: new Date()
        }
      })
    } catch (error) {
      console.error('Update feedback aggregation error:', error)
      // Don't throw - aggregation failures shouldn't break the submission
    }
  }

  static async getSessionFeedback(
    userId: string,
    sessionId: string
  ): Promise<FeedbackSubmission[]> {
    try {
      // Validate user has access to this session
      const session = await this.getSessionById(userId, sessionId)
      if (!session) {
        throw new Error('Session not found or access denied')
      }

      // Reprocess flags for this session to apply current rules
      await FeedbackService.reprocessFlagsForSession(sessionId)

      // Get feedback for this session
      const submissions = await prisma.feedbackSubmission.findMany({
        where: { sessionId },
        include: {
          targetUser: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: {
          submittedAt: 'desc'
        }
      })

      return submissions
    } catch (error) {
      console.error('Get session feedback error:', error)
      throw error
    }
  }

  static async reprocessFlagsForSession(sessionId: string): Promise<void> {
    try {
      const flagged = await prisma.feedbackSubmission.findMany({
        where: { sessionId, isFlagged: true },
        select: { id: true, content: true }
      })

      for (const s of flagged as Array<{ id: string; content: string }>) {
        const res = FeedbackService.flagInappropriateContent(s.content)
        await prisma.feedbackSubmission.update({
          where: { id: s.id },
          data: { isFlagged: res.isFlagged, flagReason: res.reason || null }
        })
      }
    } catch (error) {
      console.error('Reprocess flags error:', error)
    }
  }

  static async getUserFeedback(
    userId: string,
    targetUserId: string
  ): Promise<FeedbackSubmission[]> {
    try {
      // Only allow users to see feedback for themselves or if they're admins
      if (userId !== targetUserId) {
        // Check if user is admin of any group the target is in
        const isAdmin = await prisma.groupMember.findFirst({
          where: {
            userId,
            role: 'ADMIN',
            group: {
              members: {
                some: {
                  userId: targetUserId
                }
              }
            }
          }
        })

        if (!isAdmin) {
          throw new Error('You can only view your own feedback')
        }
      }

      const submissions = await prisma.feedbackSubmission.findMany({
        where: {
          targetUserId,
          isFlagged: false // Don't show flagged feedback
        },
        include: {
          targetUser: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: {
          submittedAt: 'desc'
        }
      })

      return submissions
    } catch (error) {
      console.error('Get user feedback error:', error)
      throw error
    }
  }

  static async updateSessionStatus(
    userId: string,
    sessionId: string,
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
  ): Promise<FeedbackSession> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      console.log('FeedbackService: Updating session:', sessionId, 'for user:', userId)

      // Get session and check permissions
      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: {
          group: true
        }
      })

      if (!session) {
        throw new Error('Session not found')
      }

      // Check if user is admin of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: session.groupId,
            userId
          }
        }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can update session status')
      }

      if (status === 'ACTIVE') {
        const membersCount = await prisma.groupMember.count({
          where: { groupId: session.groupId }
        })
        if (membersCount < 3) {
          throw new Error('At least 3 group members are required to start a session')
        }
      }

      // Update session
      const updatedSession = await prisma.feedbackSession.update({
        where: { id: sessionId },
        data: { status },
        include: {
          group: {
            select: {
              id: true,
              name: true
            }
          },
          submissions: {
            include: {
              targetUser: {
                select: {
                  id: true,
                  username: true,
                  fullName: true
                }
              }
            }
          }
        }
      })

      // Log audit event
      await AuthService.logAuditEvent(userId, 'SESSION_UPDATE', 'FeedbackSession', sessionId, {
        newStatus: status
      })

      return {
        ...updatedSession,
        submissionCount: updatedSession.submissions.length
      }
    } catch (error: any) {
      console.error('Update session status error:', error)
      throw error
    }
  }

  static async updateSession(
    userId: string,
    sessionId: string,
    updates: {
      title?: string
      description?: string
      startsAt?: Date | string | null
      endsAt?: Date | string | null
      allowSelfFeedback?: boolean
      allowAnonymousFeedback?: boolean
    }
  ): Promise<FeedbackSession> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: { group: true, submissions: { include: { targetUser: { select: { id: true, username: true, fullName: true } } } } }
      })

      if (!session) {
        throw new Error('Session not found')
      }

      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: session.groupId, userId } }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can update sessions')
      }

      const data: any = {}

      if (typeof updates.title === 'string') {
        const t = updates.title.trim()
        if (!t || t.length < 3) {
          throw new Error('Session title must be at least 3 characters long')
        }
        if (t.length > 200) {
          throw new Error('Session title must be 200 characters or less')
        }
        data.title = t
      }

      if (typeof updates.description === 'string') {
        const d = updates.description.trim()
        if (d && d.length > 1000) {
          throw new Error('Session description must be 1000 characters or less')
        }
        data.description = d || null
      }

      const toDate = (v: any) => (v === null ? null : v ? new Date(v) : undefined)
      const startsAt = toDate(updates.startsAt)
      const endsAt = toDate(updates.endsAt)
      if (startsAt !== undefined) data.startsAt = startsAt
      if (endsAt !== undefined) data.endsAt = endsAt
      if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt) {
        throw new Error('Start time must be before end time')
      }

      if (typeof updates.allowSelfFeedback !== 'undefined') {
        data.allowSelfFeedback = !!updates.allowSelfFeedback
      }

      if (typeof updates.allowAnonymousFeedback !== 'undefined') {
        data.allowAnonymousFeedback = !!updates.allowAnonymousFeedback
      }

      const updated = await prisma.feedbackSession.update({
        where: { id: sessionId },
        data,
        include: {
          group: { select: { id: true, name: true } },
          submissions: { include: { targetUser: { select: { id: true, username: true, fullName: true } } } }
        }
      })

      await AuthService.logAuditEvent(userId, 'SESSION_UPDATE', 'FeedbackSession', sessionId, {
        updated: Object.keys(data)
      })

      return {
        ...updated,
        submissionCount: updated.submissions.length
      }
    } catch (error: any) {
      console.error('Update session error:', error)
      throw error
    }
  }

  static async deleteSession(userId: string, sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required')
      }

      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: { group: true }
      })

      if (!session) {
        throw new Error('Session not found')
      }

      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: session.groupId,
            userId
          }
        }
      })

      if (!membership || membership.role !== 'ADMIN') {
        throw new Error('Only group admins can delete sessions')
      }

      await prisma.feedbackSession.delete({
        where: { id: sessionId }
      })

      await AuthService.logAuditEvent(userId, 'SESSION_DELETE', 'FeedbackSession', sessionId, {
        groupId: session.groupId,
        title: session.title
      })
    } catch (error: any) {
      console.error('Delete session error:', error)
      throw error
    }
  }
}
