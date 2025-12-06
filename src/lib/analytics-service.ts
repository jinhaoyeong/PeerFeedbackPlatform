import { prisma } from './prisma'

export interface DashboardStats {
  totalFeedbackReceived: number
  totalFeedbackGiven: number
  averageSentiment: string
  groupsCount: number
  recentActivity: Array<{
    id: string
    type: 'feedback_given' | 'feedback_received' | 'group_joined' | 'session_created'
    message: string
    timestamp: string
    data?: any
  }>
}

export interface AnalyticsData {
  sentimentTrend: Array<{
    date: string
    sentiment: string
    count: number
  }>
  feedbackByGroup: Array<{
    groupId: string
    groupName: string
    feedbackCount: number
    averageSentiment: string
  }>
  weeklyActivity: Array<{
    week: string
    feedbackGiven: number
    feedbackReceived: number
  }>
  topFeedbackThemes: Array<{
    theme: string
    count: number
    sentiment: string
  }>
}

export class AnalyticsService {
  static async getDashboardStats(userId: string): Promise<DashboardStats> {
    try {
      // Get feedback counts
      const [feedbackReceived, groupsCount] = await Promise.all([
        prisma.feedbackSubmission.count({
          where: {
            targetUserId: userId,
            isFlagged: false
          }
        }),
        prisma.groupMember.count({
          where: { userId }
        })
      ])

      const logs = await prisma.auditLog.findMany({
        where: { userId, action: 'FEEDBACK_SUBMIT' },
        select: { details: true }
      })
      const feedbackGiven = logs.reduce((count: number, log: any) => {
        try {
          const d = log.details ? JSON.parse(log.details as string) : null
          return count + ((d && d.isAnonymous === false) ? 1 : 0)
        } catch {
          return count
        }
      }, 0)

      // Get user's average sentiment
      const aggregation = await prisma.feedbackAggregation.findUnique({
        where: { userId }
      })

      // Get recent activity
      const recentAuditLogs = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: 10
      })

      const recentActivity = recentAuditLogs.map((log: any) => {
        let type: any = 'feedback_given'
        let message = ''

        switch (log.action) {
          case 'USER_LOGIN':
            return null // Skip login events
          case 'FEEDBACK_SUBMIT':
            type = 'feedback_given'
            message = 'You provided feedback'
            break
          case 'GROUP_JOIN':
            type = 'group_joined'
            message = 'You joined a group'
            break
          case 'SESSION_CREATE':
            type = 'session_created'
            message = 'You created a feedback session'
            break
          default:
            type = 'feedback_given'
            message = 'Activity recorded'
        }

        return {
          id: log.id,
          type,
          message,
          timestamp: this.formatRelativeTime(log.occurredAt),
          data: log.details ? JSON.parse(log.details) : undefined
        }
      }).filter(Boolean) as DashboardStats['recentActivity']

      return {
        totalFeedbackReceived: feedbackReceived,
        totalFeedbackGiven: feedbackGiven,
        averageSentiment: aggregation?.averageSentiment || 'NEUTRAL',
        groupsCount,
        recentActivity
      }
    } catch (error) {
      console.error('Get dashboard stats error:', error)
      throw new Error('Failed to retrieve dashboard statistics')
    }
  }

  static async getAnalyticsData(userId: string, timeRange: 'week' | 'month' | 'quarter' | 'year'): Promise<AnalyticsData> {
    try {
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      // Get sentiment trend
      const sentimentTrend = await this.getSentimentTrend(userId, startDate)

      // Get feedback by group
      const feedbackByGroup = await this.getFeedbackByGroup(userId)

      // Get weekly activity
      const weeklyActivity = await this.getWeeklyActivity(userId, startDate)

      // Get top feedback themes (simplified)
      const topFeedbackThemes = await this.getTopFeedbackThemes(userId)

      return {
        sentimentTrend,
        feedbackByGroup,
        weeklyActivity,
        topFeedbackThemes
      }
    } catch (error) {
      console.error('Get analytics data error:', error)
      throw new Error('Failed to retrieve analytics data')
    }
  }

  private static async getSentimentTrend(userId: string, startDate: Date) {
    const submissions = await prisma.feedbackSubmission.findMany({
      where: {
        targetUserId: userId,
        isFlagged: false,
        submittedAt: {
          gte: startDate
        }
      },
      select: {
        sentiment: true,
        submittedAt: true
      },
      orderBy: {
        submittedAt: 'asc'
      }
    })

    // Group by date
    const groupedByDate: { [key: string]: { [sentiment: string]: number } } = {}

    submissions.forEach((submission: any) => {
      const date = submission.submittedAt.toISOString().split('T')[0]
      if (!groupedByDate[date]) {
        groupedByDate[date] = {}
      }
      if (submission.sentiment) {
        groupedByDate[date][submission.sentiment] = (groupedByDate[date][submission.sentiment] || 0) + 1
      }
    })

    return Object.entries(groupedByDate).map(([date, sentiments]) => {
      const dominantSentiment = Object.entries(sentiments)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'NEUTRAL'

      return {
        date,
        sentiment: dominantSentiment,
        count: Object.values(sentiments).reduce((sum, count) => sum + count, 0)
      }
    })
  }

  private static async getFeedbackByGroup(userId: string) {
    const feedbackByGroup = await prisma.feedbackSubmission.groupBy({
      by: ['sessionId'],
      where: {
        targetUserId: userId,
        isFlagged: false
      },
      _count: {
        id: true
      }
    })

    // Get session details with group information
    const sessionIds = feedbackByGroup.map((item: any) => item.sessionId)
    const sessions = await prisma.feedbackSession.findMany({
      where: {
        id: {
          in: sessionIds
        }
      },
      include: {
        group: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const sessionMap = sessions.reduce((acc: any, session: any) => {
      acc[session.id] = session.group
      return acc
    }, {} as { [key: string]: { id: string; name: string } })

    return feedbackByGroup.map((item: any) => ({
      groupId: sessionMap[item.sessionId]?.id || 'unknown',
      groupName: sessionMap[item.sessionId]?.name || 'Unknown Group',
      feedbackCount: item._count.id,
      averageSentiment: 'NEUTRAL' // Simplified - would need more complex query
    }))
  }

  private static async getWeeklyActivity(userId: string, startDate: Date) {
    // Get feedback given and received by week
    const submissions = await prisma.feedbackSubmission.findMany({
      where: {
        OR: [
          { targetUserId: userId },
          // In a real implementation, we'd track who gave feedback
        ],
        isFlagged: false,
        submittedAt: {
          gte: startDate
        }
      },
      select: {
        targetUserId: true,
        submittedAt: true
      }
    })

    // Group by week
    const weeklyData: { [key: string]: { feedbackGiven: number; feedbackReceived: number } } = {}

    submissions.forEach((submission: any) => {
      const week = this.getWeekKey(submission.submittedAt)
      if (!weeklyData[week]) {
        weeklyData[week] = { feedbackGiven: 0, feedbackReceived: 0 }
      }

      if (submission.targetUserId === userId) {
        weeklyData[week].feedbackReceived++
      } else {
        weeklyData[week].feedbackGiven++
      }
    })

    return Object.entries(weeklyData).map(([week, data]) => ({
      week,
      feedbackGiven: data.feedbackGiven,
      feedbackReceived: data.feedbackReceived
    })).sort((a, b) => a.week.localeCompare(b.week))
  }

  private static async getTopFeedbackThemes(userId: string) {
    // This is a simplified implementation
    // In a real system, we'd use NLP to extract themes from feedback content
    const submissions = await prisma.feedbackSubmission.findMany({
      where: {
        targetUserId: userId,
        isFlagged: false
      },
      select: {
        content: true,
        sentiment: true
      },
      take: 100
    })

    // Simple keyword-based theme extraction
    const themes = [
      { theme: 'Communication', keywords: ['communication', 'talking', 'listening', 'speaking'] },
      { theme: 'Leadership', keywords: ['leadership', 'leading', 'managing', 'guiding'] },
      { theme: 'Technical Skills', keywords: ['technical', 'coding', 'programming', 'skills'] },
      { theme: 'Teamwork', keywords: ['teamwork', 'collaboration', 'team', 'cooperation'] },
      { theme: 'Creativity', keywords: ['creative', 'innovation', 'ideas', 'thinking'] }
    ]

    const themeCounts = themes.map(theme => {
      const count = submissions.filter((submission: any) => {
        const content = submission.content.toLowerCase()
        return theme.keywords.some((keyword: any) => content.includes(keyword))
      }).length

      return {
        theme: theme.theme,
        count,
        sentiment: 'NEUTRAL' // Simplified
      }
    }).filter(theme => theme.count > 0)

    return themeCounts.sort((a, b) => b.count - a.count).slice(0, 5)
  }

  private static getWeekKey(date: Date): string {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    return startOfWeek.toISOString().split('T')[0]
  }

  private static formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }
}
