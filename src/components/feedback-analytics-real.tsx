'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Users,
  Star,
  Download,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  Target,
  Loader2,
} from 'lucide-react'

interface RealAnalyticsData {
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

interface FeedbackAnalyticsProps {
  timeRange: 'week' | 'month' | 'quarter' | 'year'
}

export function FeedbackAnalyticsReal({ timeRange }: FeedbackAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<RealAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetailed, setShowDetailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.getAnalyticsData(timeRange)

        if ((response as any)?.analytics) {
          setAnalyticsData((response as any).analytics)
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [timeRange])

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'VERY_POSITIVE':
      case 'POSITIVE':
        return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-500/10 dark:ring-emerald-500/20'
      case 'NEUTRAL':
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-500/10 dark:ring-slate-500/20'
      case 'NEGATIVE':
      case 'VERY_NEGATIVE':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-500/10 dark:ring-rose-500/20'
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-500/10 dark:ring-slate-500/20'
    }
  }

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    if (current < previous) return <ArrowDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
    return <Minus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
  }

  const exportAnalytics = () => {
    if (analyticsData) {
      const dataStr = JSON.stringify(analyticsData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
      const exportFileDefaultName = `feedback-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`

      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <BarChart3 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Failed to load analytics</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <BarChart3 className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No analytics data available</h3>
          <p className="text-slate-600 dark:text-slate-400">Start collecting feedback to see analytics here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Feedback Analytics</h3>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <select
                value={timeRange}
                className="pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none font-medium cursor-pointer transition-all"
                onChange={(e) => {
                  window.location.href = `/dashboard?analytics=true&timeRange=${e.target.value}`
                }}
              >
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="quarter">Past Quarter</option>
                <option value="year">Past Year</option>
              </select>
              <Minus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 rotate-90 pointer-events-none" />
            </div>

            <button
              onClick={() => setShowDetailed(!showDetailed)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium flex items-center shadow-sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showDetailed ? 'Hide Details' : 'Show Details'}
            </button>

            <button
              onClick={exportAnalytics}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors font-medium flex items-center shadow-sm hover:shadow-md"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="p-6">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900 dark:text-white block mb-1">
              {analyticsData.weeklyActivity.reduce((sum, week) => sum + week.feedbackReceived, 0)}
            </span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Feedback Received</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900 dark:text-white block mb-1">
              {analyticsData.weeklyActivity.reduce((sum, week) => sum + week.feedbackGiven, 0)}
            </span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Feedback Given</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900 dark:text-white block mb-1">
              {analyticsData.feedbackByGroup.length}
            </span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Groups</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <span className="text-3xl font-bold text-slate-900 dark:text-white block mb-1">
              {analyticsData.topFeedbackThemes.length}
            </span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Key Themes</p>
          </div>
        </div>

        {/* Feedback by Group */}
        <div className="mb-8">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Feedback by Group
          </h4>
          <div className="space-y-3">
            {analyticsData.feedbackByGroup.map((group) => (
              <div key={group.groupId} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{group.groupName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{group.feedbackCount} feedback items</p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(group.averageSentiment)}`}>
                    {group.averageSentiment}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed View */}
        {showDetailed && (
          <div className="space-y-8 animate-in slide-in-from-top-4 duration-300">
            {/* Sentiment Trends */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Sentiment Trends</h4>
              <div className="space-y-4">
                {analyticsData.sentimentTrend.map((trend, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                    <div className="w-24 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {new Date(trend.date).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(trend.sentiment)}`}>
                          {trend.sentiment}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">({trend.count} items)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Activity */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Activity</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Week</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Feedback Given</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Feedback Received</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {analyticsData.weeklyActivity.map((week) => (
                      <tr key={week.week} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{week.week}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{week.feedbackGiven}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{week.feedbackReceived}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Feedback Themes */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Top Feedback Themes</h4>
              <div className="space-y-3">
                {analyticsData.topFeedbackThemes.map((theme, index) => (
                  <div key={theme.theme} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{theme.theme}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{theme.count} mentions</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${getSentimentColor(theme.sentiment)}`}>
                      {theme.sentiment}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}