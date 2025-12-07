import { prisma } from './prisma'
import Sentiment from 'sentiment'

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
    distribution: {
      VERY_NEGATIVE: number
      NEGATIVE: number
      NEUTRAL: number
      POSITIVE: number
      VERY_POSITIVE: number
    }
    total: number
    dominant: string
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
    examples: Array<{ text: string; sentiment: string }>
    distribution?: {
      VERY_NEGATIVE: number
      NEGATIVE: number
      NEUTRAL: number
      POSITIVE: number
      VERY_POSITIVE: number
    }
  }>
  totals?: {
    feedbackCount: number
  }
  participants?: {
    submitters: number
    targets: number
    engaged: number
  }
  sentimentDistribution?: {
    VERY_NEGATIVE: number
    NEGATIVE: number
    NEUTRAL: number
    POSITIVE: number
    VERY_POSITIVE: number
  }
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
        select: { id: true }
      })
      const feedbackGiven = logs.length

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

      const topFeedbackThemes = await this.getTopFeedbackThemes(userId, startDate)

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

  static async getSessionAnalytics(userId: string, sessionId: string): Promise<AnalyticsData> {
    try {
      

      const sentimentTrend = await prisma.feedbackSubmission.findMany({
        where: {
          sessionId,
          
        },
        select: { sentiment: true, submittedAt: true },
        orderBy: { submittedAt: 'asc' }
      }).then((submissions: any[]) => {
        const groupedByDate: { [key: string]: { [sentiment: string]: number } } = {}
        submissions.forEach((submission: any) => {
          const date = submission.submittedAt.toISOString().split('T')[0]
          if (!groupedByDate[date]) groupedByDate[date] = {}
          if (submission.sentiment) {
            groupedByDate[date][submission.sentiment] = (groupedByDate[date][submission.sentiment] || 0) + 1
          }
        })
        return Object.entries(groupedByDate).map(([date, sentiments]) => {
          const distribution = {
            VERY_NEGATIVE: sentiments['VERY_NEGATIVE'] || 0,
            NEGATIVE: sentiments['NEGATIVE'] || 0,
            NEUTRAL: sentiments['NEUTRAL'] || 0,
            POSITIVE: sentiments['POSITIVE'] || 0,
            VERY_POSITIVE: sentiments['VERY_POSITIVE'] || 0,
          }
          const total = Object.values(sentiments).reduce((sum: number, c: number) => sum + c, 0)
          const dominant = Object.entries(sentiments).sort(([, a], [, b]) => b - a)[0]?.[0] || 'NEUTRAL'
          return { date, distribution, total, dominant }
        })
      })

      const session = await prisma.feedbackSession.findUnique({
        where: { id: sessionId },
        include: { group: { select: { id: true, name: true } } }
      })

      let feedbackByGroup: Array<{ groupId: string; groupName: string; feedbackCount: number; averageSentiment: string }>
      let sentimentDistribution: { VERY_NEGATIVE: number; NEGATIVE: number; NEUTRAL: number; POSITIVE: number; VERY_POSITIVE: number } = {
        VERY_NEGATIVE: 0,
        NEGATIVE: 0,
        NEUTRAL: 0,
        POSITIVE: 0,
        VERY_POSITIVE: 0
      }
      let participants: { submitters: number; targets: number; engaged: number } = { submitters: 0, targets: 0, engaged: 0 }
      let totals: { feedbackCount: number } = { feedbackCount: 0 }
      if (session?.group) {
        const submissionsAll = await prisma.feedbackSubmission.findMany({
          where: { sessionId },
          select: { sentiment: true, targetUserId: true, submitterId: true }
        })

        const sentimentScores: Record<string, number> = {
          VERY_NEGATIVE: -2,
          NEGATIVE: -1,
          NEUTRAL: 0,
          POSITIVE: 1,
          VERY_POSITIVE: 2
        }

        const scoreSum = submissionsAll.reduce((sum: number, s: any) => sum + (sentimentScores[String(s.sentiment || 'NEUTRAL').toUpperCase()] ?? 0), 0)
        const scoreCount = submissionsAll.filter((s: any) => s.sentiment).length
        const avg = scoreCount > 0 ? scoreSum / scoreCount : 0
        const labelForAvg = (avg: number) => {
          if (avg >= 1.5) return 'VERY_POSITIVE'
          if (avg >= 0.5) return 'POSITIVE'
          if (avg >= -0.5) return 'NEUTRAL'
          if (avg >= -1.5) return 'NEGATIVE'
          return 'VERY_NEGATIVE'
        }

        feedbackByGroup = [{
          groupId: session.group.id,
          groupName: session.group.name,
          feedbackCount: submissionsAll.length,
          averageSentiment: labelForAvg(avg)
        }]
        submissionsAll.forEach((s: any) => {
          const key = String(s.sentiment || 'NEUTRAL').toUpperCase() as keyof typeof sentimentDistribution
          sentimentDistribution[key] = (sentimentDistribution[key] || 0) + 1
        })

        const uniqueSubmitters = new Set(submissionsAll.map((s: any) => s.submitterId).filter(Boolean)).size
        const uniqueTargets = new Set(submissionsAll.map((s: any) => s.targetUserId).filter(Boolean)).size
        participants = { submitters: uniqueSubmitters, targets: uniqueTargets, engaged: uniqueSubmitters + uniqueTargets }
        totals = { feedbackCount: submissionsAll.length }
      } else {
        feedbackByGroup = []
        participants = { submitters: 0, targets: 0, engaged: 0 }
        totals = { feedbackCount: 0 }
      }

      const submissionsForActivity = await prisma.feedbackSubmission.findMany({
        where: { sessionId },
        select: { submittedAt: true }
      })

      const weeklyData: { [key: string]: { feedbackGiven: number; feedbackReceived: number } } = {}

      const getWeekKey = (date: Date) => {
        const d = new Date(date)
        d.setDate(d.getDate() - d.getDay())
        return d.toISOString().split('T')[0]
      }

      submissionsForActivity.forEach((s: any) => {
        const wk = getWeekKey(s.submittedAt)
        if (!weeklyData[wk]) weeklyData[wk] = { feedbackGiven: 0, feedbackReceived: 0 }
        weeklyData[wk].feedbackGiven++
        weeklyData[wk].feedbackReceived++
      })

      const weeklyActivity = Object.entries(weeklyData).map(([week, data]) => ({ week, feedbackGiven: data.feedbackGiven, feedbackReceived: data.feedbackReceived })).sort((a, b) => a.week.localeCompare(b.week))

      const topFeedbackThemes = await prisma.feedbackSubmission.findMany({
        where: { sessionId },
        select: { content: true, sentiment: true },
        take: 500
      }).then((submissions: any[]) => this.computeTopThemes(submissions))

      return { sentimentTrend, feedbackByGroup, weeklyActivity, topFeedbackThemes, totals, participants, sentimentDistribution }
    } catch (error) {
      console.error('Get session analytics data error:', error)
      throw new Error('Failed to retrieve session analytics data')
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
      const distribution = {
        VERY_NEGATIVE: sentiments['VERY_NEGATIVE'] || 0,
        NEGATIVE: sentiments['NEGATIVE'] || 0,
        NEUTRAL: sentiments['NEUTRAL'] || 0,
        POSITIVE: sentiments['POSITIVE'] || 0,
        VERY_POSITIVE: sentiments['VERY_POSITIVE'] || 0,
      }
      const total = Object.values(sentiments).reduce((sum, count) => sum + count, 0)
      const dominant = Object.entries(sentiments).sort(([, a], [, b]) => b - a)[0]?.[0] || 'NEUTRAL'
      return { date, distribution, total, dominant }
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

    const sentiments = await prisma.feedbackSubmission.findMany({
      where: {
        targetUserId: userId,
        isFlagged: false,
        sessionId: { in: sessionIds }
      },
      select: {
        sessionId: true,
        sentiment: true
      }
    })

    const sentimentScores: Record<string, number> = {
      VERY_NEGATIVE: -2,
      NEGATIVE: -1,
      NEUTRAL: 0,
      POSITIVE: 1,
      VERY_POSITIVE: 2
    }

    const groupAgg: Record<string, { name: string; count: number; scoreSum: number; scoreCount: number }> = {}

    feedbackByGroup.forEach((item: any) => {
      const g = sessionMap[item.sessionId]
      const gid = g?.id || 'unknown'
      const name = g?.name || 'Unknown Group'
      if (!groupAgg[gid]) groupAgg[gid] = { name, count: 0, scoreSum: 0, scoreCount: 0 }
      groupAgg[gid].count += item._count.id
    })

    sentiments.forEach((s: any) => {
      const g = sessionMap[s.sessionId]
      const gid = g?.id || 'unknown'
      const name = g?.name || 'Unknown Group'
      if (!groupAgg[gid]) groupAgg[gid] = { name, count: 0, scoreSum: 0, scoreCount: 0 }
      const key = String(s.sentiment || 'NEUTRAL').toUpperCase()
      const score = sentimentScores[key] ?? 0
      groupAgg[gid].scoreSum += score
      groupAgg[gid].scoreCount += 1
    })

    const labelForAvg = (avg: number) => {
      if (avg >= 1.5) return 'VERY_POSITIVE'
      if (avg >= 0.5) return 'POSITIVE'
      if (avg >= -0.5) return 'NEUTRAL'
      if (avg >= -1.5) return 'NEGATIVE'
      return 'VERY_NEGATIVE'
    }

    return Object.entries(groupAgg).map(([groupId, agg]) => ({
      groupId,
      groupName: agg.name,
      feedbackCount: agg.count,
      averageSentiment: agg.scoreCount > 0 ? labelForAvg(agg.scoreSum / agg.scoreCount) : 'NEUTRAL'
    }))
  }

  private static async getWeeklyActivity(userId: string, startDate: Date) {
    const received = await prisma.feedbackSubmission.findMany({
      where: { targetUserId: userId, isFlagged: false, submittedAt: { gte: startDate } },
      select: { submittedAt: true }
    })

    const givenLogs = await prisma.auditLog.findMany({
      where: { userId, action: 'FEEDBACK_SUBMIT', occurredAt: { gte: startDate } },
      select: { occurredAt: true }
    })

    const weeklyData: { [key: string]: { feedbackGiven: number; feedbackReceived: number } } = {}

    const getWeekKey = (date: Date) => {
      const d = new Date(date)
      d.setDate(d.getDate() - d.getDay())
      return d.toISOString().split('T')[0]
    }

    received.forEach((r: any) => {
      const wk = getWeekKey(r.submittedAt)
      if (!weeklyData[wk]) weeklyData[wk] = { feedbackGiven: 0, feedbackReceived: 0 }
      weeklyData[wk].feedbackReceived++
    })

    givenLogs.forEach((l: any) => {
      const wk = getWeekKey(l.occurredAt)
      if (!weeklyData[wk]) weeklyData[wk] = { feedbackGiven: 0, feedbackReceived: 0 }
      weeklyData[wk].feedbackGiven++
    })

    return Object.entries(weeklyData).map(([week, data]) => ({ week, feedbackGiven: data.feedbackGiven, feedbackReceived: data.feedbackReceived })).sort((a, b) => a.week.localeCompare(b.week))
  }

  private static async getTopFeedbackThemes(userId: string, startDate: Date) {
    const submissions = await prisma.feedbackSubmission.findMany({
      where: { targetUserId: userId, isFlagged: false, submittedAt: { gte: startDate } },
      select: { content: true, sentiment: true },
      take: 500
    })

    return this.computeTopThemes(submissions)
  }

  private static computeTopThemes(submissions: Array<{ content: string; sentiment?: string }>) {
    const stop = new Set([
      'the','a','an','and','or','but','if','in','on','at','to','for','of','with','without','by','from','is','are','was','were','be','been','being','it','this','that','i','you','he','she','we','they','them','me','my','your','our','their',
      'when','which','would','could','should','also','very','really','just','like','so','then','than','because','as','while','where','what','who','whose','whom','there','here','into','about','across','over','under','again','still','already',
      'session','feedback','user','team','work','project','during'
    ])

    const scoreMap: Record<string, number> = {
      VERY_NEGATIVE: -2,
      NEGATIVE: -1,
      NEUTRAL: 0,
      POSITIVE: 1,
      VERY_POSITIVE: 2
    }

    const agg: Record<string, { count: number; scoreSum: number; scoreCount: number; examples: Array<{ text: string; sentiment: string }>; distribution: { VERY_NEGATIVE: number; NEGATIVE: number; NEUTRAL: number; POSITIVE: number; VERY_POSITIVE: number } }> = {}
    const localSentiment = new Sentiment()

    submissions.forEach((s: any) => {
      const text = String(s.content || '').toLowerCase().replace(/[^a-z\s]/g, ' ')
      const raw = text.split(/\s+/).filter(Boolean)
      const tokens = raw.filter(t => t.length > 2 && !stop.has(t))
      const score = scoreMap[String(s.sentiment || 'NEUTRAL').toUpperCase()] ?? 0

      for (const tok of tokens) {
        if (!agg[tok]) agg[tok] = { count: 0, scoreSum: 0, scoreCount: 0, examples: [], distribution: { VERY_NEGATIVE: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0, VERY_POSITIVE: 0 } }
        agg[tok].count += 1
        const sentences = String(s.content || '').split(/[.!?\n]+/).map(v => v.trim()).filter(Boolean)
        let used = false
        for (const sent of sentences) {
          const sentLower = sent.toLowerCase()
          if (sentLower.includes(tok)) {
            const res = localSentiment.analyze(sent)
            let lvl = 0
            if (res.score >= 2) lvl = 2
            else if (res.score >= 1) lvl = 1
            else if (res.score <= -2) lvl = -2
            else if (res.score <= -1) lvl = -1
            else lvl = 0
            agg[tok].scoreSum += lvl
            agg[tok].scoreCount += 1
            const lbl = lvl >= 2 ? 'VERY_POSITIVE' : lvl === 1 ? 'POSITIVE' : lvl === -1 ? 'NEGATIVE' : lvl <= -2 ? 'VERY_NEGATIVE' : 'NEUTRAL'
            agg[tok].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
            if (agg[tok].examples.length < 3) agg[tok].examples.push({ text: sent, sentiment: lbl })
            used = true
          }
        }
        if (!used) {
          agg[tok].scoreSum += score
          agg[tok].scoreCount += 1
          const lbl = score >= 1.5 ? 'VERY_POSITIVE' : score >= 0.5 ? 'POSITIVE' : score >= -0.5 ? 'NEUTRAL' : score >= -1.5 ? 'NEGATIVE' : 'VERY_NEGATIVE'
          agg[tok].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
        }
      }

      for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i]
        const b = tokens[i + 1]
        if (!a || !b) continue
        const phrase = `${a} ${b}`
        if (!agg[phrase]) agg[phrase] = { count: 0, scoreSum: 0, scoreCount: 0, examples: [], distribution: { VERY_NEGATIVE: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0, VERY_POSITIVE: 0 } }
        agg[phrase].count += 1
        const sentences = String(s.content || '').split(/[.!?\n]+/).map(v => v.trim()).filter(Boolean)
        let used = false
        for (const sent of sentences) {
          const sentLower = sent.toLowerCase()
          if (sentLower.includes(phrase)) {
            const res = localSentiment.analyze(sent)
            let lvl = 0
            if (res.score >= 2) lvl = 2
            else if (res.score >= 1) lvl = 1
            else if (res.score <= -2) lvl = -2
            else if (res.score <= -1) lvl = -1
            else lvl = 0
            agg[phrase].scoreSum += lvl
            agg[phrase].scoreCount += 1
            const lbl = lvl >= 2 ? 'VERY_POSITIVE' : lvl === 1 ? 'POSITIVE' : lvl === -1 ? 'NEGATIVE' : lvl <= -2 ? 'VERY_NEGATIVE' : 'NEUTRAL'
            agg[phrase].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
            if (agg[phrase].examples.length < 3) agg[phrase].examples.push({ text: sent, sentiment: lbl })
            used = true
          }
        }
        if (!used) {
          agg[phrase].scoreSum += score
          agg[phrase].scoreCount += 1
          const lbl = score >= 1.5 ? 'VERY_POSITIVE' : score >= 0.5 ? 'POSITIVE' : score >= -0.5 ? 'NEUTRAL' : score >= -1.5 ? 'NEGATIVE' : 'VERY_NEGATIVE'
          agg[phrase].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
        }
      }

      for (let i = 0; i < tokens.length - 2; i++) {
        const a = tokens[i]
        const b = tokens[i + 1]
        const c = tokens[i + 2]
        if (!a || !b || !c) continue
        const phrase3 = `${a} ${b} ${c}`
        if (!agg[phrase3]) agg[phrase3] = { count: 0, scoreSum: 0, scoreCount: 0, examples: [], distribution: { VERY_NEGATIVE: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0, VERY_POSITIVE: 0 } }
        agg[phrase3].count += 1
        const sentences = String(s.content || '').split(/[.!?\n]+/).map(v => v.trim()).filter(Boolean)
        let used3 = false
        for (const sent of sentences) {
          const sentLower = sent.toLowerCase()
          if (sentLower.includes(phrase3)) {
            const res = localSentiment.analyze(sent)
            let lvl = 0
            if (res.score >= 2) lvl = 2
            else if (res.score >= 1) lvl = 1
            else if (res.score <= -2) lvl = -2
            else if (res.score <= -1) lvl = -1
            else lvl = 0
            agg[phrase3].scoreSum += lvl
            agg[phrase3].scoreCount += 1
            const lbl = lvl >= 2 ? 'VERY_POSITIVE' : lvl === 1 ? 'POSITIVE' : lvl === -1 ? 'NEGATIVE' : lvl <= -2 ? 'VERY_NEGATIVE' : 'NEUTRAL'
            agg[phrase3].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
            if (agg[phrase3].examples.length < 3) agg[phrase3].examples.push({ text: sent, sentiment: lbl })
            used3 = true
          }
        }
        if (!used3) {
          agg[phrase3].scoreSum += score
          agg[phrase3].scoreCount += 1
          const lbl = score >= 1.5 ? 'VERY_POSITIVE' : score >= 0.5 ? 'POSITIVE' : score >= -0.5 ? 'NEUTRAL' : score >= -1.5 ? 'NEGATIVE' : 'VERY_NEGATIVE'
          agg[phrase3].distribution[lbl as 'VERY_NEGATIVE' | 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'VERY_POSITIVE']++
        }
      }
    })

    const labelForAvg = (avg: number) => {
      if (avg >= 1.5) return 'VERY_POSITIVE'
      if (avg >= 0.5) return 'POSITIVE'
      if (avg >= -0.5) return 'NEUTRAL'
      if (avg >= -1.5) return 'NEGATIVE'
      return 'VERY_NEGATIVE'
    }

    const filtered = Object.entries(agg).filter(([key, v]) => {
      const isPhrase = key.includes(' ')
      const min = isPhrase ? 2 : 4
      return v.count >= min
    })

    const phrases = filtered.filter(([k]) => k.includes(' ')).sort((a, b) => b[1].count - a[1].count)
    const singles = filtered.filter(([k]) => !k.includes(' ')).sort((a, b) => b[1].count - a[1].count)

    const top: Array<[
      string,
      { count: number; scoreSum: number; scoreCount: number; examples: Array<{ text: string; sentiment: string }>; distribution: { VERY_NEGATIVE: number; NEGATIVE: number; NEUTRAL: number; POSITIVE: number; VERY_POSITIVE: number } }
    ]> = []
    for (const e of phrases) {
      if (top.length < 5) top.push(e)
    }
    if (top.length < 5) {
      for (const e of singles) {
        if (top.length < 5) top.push(e)
      }
    }

    return top.map(([theme, v]) => {
      const label = v.scoreCount > 0 ? labelForAvg(v.scoreSum / v.scoreCount) : 'NEUTRAL'
      const examplesMatching = (v.examples || []).filter(e => e.sentiment === label)
      const examples = examplesMatching.length > 0 ? examplesMatching : (v.examples || [])
      return {
        theme,
        count: v.count,
        sentiment: label,
        examples: examples.slice(0, 2),
        distribution: v.distribution
      }
    })
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
