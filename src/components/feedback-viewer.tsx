'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Star,
  Filter,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Search
} from 'lucide-react'
import { useSettings } from '@/components/settings-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FeedbackItem {
  id: string
  sessionId: string
  sessionTitle: string
  content: string
  sentiment: 'VERY_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'VERY_NEGATIVE'
  submittedAt: string
  isFlagged: boolean
  flagReason?: string
  submitterId?: string
  targetUserId: string
  targetUserName: string
}

interface FeedbackViewerProps {
  feedback: FeedbackItem[]
  userName: string
  onFilterChange?: (filters: FeedbackFilters) => void
}

interface FeedbackFilters {
  sentiment: 'all' | 'positive' | 'neutral' | 'negative'
  dateRange: 'all' | 'week' | 'month' | 'year'
  flagged: 'all' | 'flagged' | 'unflagged'
  sortBy: 'date' | 'sentiment' | 'relevance'
  sortOrder: 'desc' | 'asc'
}

export function FeedbackViewer({ feedback, userName, onFilterChange }: FeedbackViewerProps) {
  const { formatDate } = useSettings()
  const [filters, setFilters] = useState<FeedbackFilters>({
    sentiment: 'all',
    dateRange: 'all',
    flagged: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'VERY_POSITIVE':
      case 'POSITIVE':
        return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/10 dark:ring-emerald-400/20'
      case 'NEUTRAL':
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-500/10 dark:ring-slate-400/20'
      case 'NEGATIVE':
      case 'VERY_NEGATIVE':
        return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 ring-1 ring-rose-500/10 dark:ring-rose-400/20'
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-500/10 dark:ring-slate-400/20'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'VERY_POSITIVE':
        return <TrendingUp className="h-4 w-4" />
      case 'POSITIVE':
        return <ThumbsUp className="h-4 w-4" />
      case 'NEUTRAL':
        return <Minus className="h-4 w-4" />
      case 'NEGATIVE':
        return <ThumbsDown className="h-4 w-4" />
      case 'VERY_NEGATIVE':
        return <TrendingDown className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'VERY_POSITIVE':
        return 'Very Positive'
      case 'POSITIVE':
        return 'Positive'
      case 'NEUTRAL':
        return 'Neutral'
      case 'NEGATIVE':
        return 'Negative'
      case 'VERY_NEGATIVE':
        return 'Very Negative'
      default:
        return 'Unknown'
    }
  }

  const getFlagReasonLabel = (reason?: string) => {
    switch (String(reason || '').toUpperCase()) {
      case 'INAPPROPRIATE_LANGUAGE':
        return 'Inappropriate language'
      case 'SPAM':
        return 'Spam-like pattern'
      case 'TOO_SHORT':
        return 'Too short'
      default:
        return ''
    }
  }

  const filterAndSortFeedback = (items: FeedbackItem[]) => {
    return items
      .filter(item => {
        // Sentiment filter
        if (filters.sentiment === 'positive' && !item.sentiment.includes('POSITIVE')) return false
        if (filters.sentiment === 'negative' && !item.sentiment.includes('NEGATIVE')) return false
        if (filters.sentiment === 'neutral' && item.sentiment !== 'NEUTRAL') return false

        // Flagged filter
        if (filters.flagged === 'flagged' && !item.isFlagged) return false
        if (filters.flagged === 'unflagged' && item.isFlagged) return false

        // Date range filter
        const itemDate = new Date(item.submittedAt)
        const now = new Date()
        if (filters.dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (itemDate < weekAgo) return false
        }
        if (filters.dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (itemDate < monthAgo) return false
        }
        if (filters.dateRange === 'year') {
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          if (itemDate < yearAgo) return false
        }

        return true
      })
      .sort((a, b) => {
        let comparison = 0

        // Sort by field
        if (filters.sortBy === 'date') {
          comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        } else if (filters.sortBy === 'sentiment') {
          const sentimentOrder = {
            'VERY_POSITIVE': 5,
            'POSITIVE': 4,
            'NEUTRAL': 3,
            'NEGATIVE': 2,
            'VERY_NEGATIVE': 1
          }
          comparison = sentimentOrder[a.sentiment] - sentimentOrder[b.sentiment]
        } else if (filters.sortBy === 'relevance') {
          // Sort by sentiment score and recency
          const sentimentOrder = {
            'VERY_POSITIVE': 5,
            'POSITIVE': 4,
            'NEUTRAL': 3,
            'NEGATIVE': 2,
            'VERY_NEGATIVE': 1
          }
          const aScore = sentimentOrder[a.sentiment] + (new Date(a.submittedAt).getTime() / 1000000)
          const bScore = sentimentOrder[b.sentiment] + (new Date(b.submittedAt).getTime() / 1000000)
          comparison = bScore - aScore
        }

        // Apply sort order
        return filters.sortOrder === 'asc' ? comparison : -comparison
      })
  }

  const filteredFeedback = filterAndSortFeedback(feedback)

  const handleFilterChange = (newFilters: Partial<FeedbackFilters>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    onFilterChange?.(updatedFilters)
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
    } else if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
    } else {
      return formatDate(date)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Feedback Received
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 ml-11">
              {filteredFeedback.length} total feedback item{filteredFeedback.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2.5 border rounded-xl transition-all ${
              showFilters 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-5 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Sentiment Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Sentiment</label>
                <div className="relative">
                  <select
                    value={filters.sentiment}
                    onChange={(e) => handleFilterChange({ sentiment: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-sm text-slate-700 dark:text-white font-medium"
                  >
                    <option value="all">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Time Period</label>
                <div className="relative">
                  <select
                    value={filters.dateRange}
                    onChange={(e) => handleFilterChange({ dateRange: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none text-sm text-slate-700 dark:text-white font-medium"
                  >
                    <option value="all">All Time</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                    <option value="year">Past Year</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => handleFilterChange({ sortBy: value as any })}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="sentiment">Sentiment</SelectItem>
                    <SelectItem value="relevance">Most Relevant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Order</label>
                <Select
                  value={filters.sortOrder}
                  onValueChange={(value) => handleFilterChange({ sortOrder: value as any })}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Order..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search feedback content..."
            className="w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-700 dark:text-white bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Feedback List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {filteredFeedback.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-full p-4 w-fit mx-auto mb-4">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No feedback found</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">Try adjusting your filters or search terms to find what you're looking for</p>
          </div>
        ) : (
          filteredFeedback.map((item) => (
            <div key={item.id} className="p-6 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-all hover:shadow-sm group">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-2.5 rounded-xl shadow-sm ${getSentimentColor(item.sentiment)}`}>
                    {getSentimentIcon(item.sentiment)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5 text-sm mb-1">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border border-current/10 ${getSentimentColor(item.sentiment)}`}>
                        {getSentimentLabel(item.sentiment)}
                      </span>
                      {item.isFlagged && (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-full flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {`Flagged${getFlagReasonLabel(item.flagReason) ? ' — ' + getFlagReasonLabel(item.flagReason) : ''}`}
                        </span>
                      )}
                      <span className="text-slate-300 text-xs">•</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatDate(item.submittedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expand/Collapse Button */}
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  {expandedItems.has(item.id) ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Content */}
              {!expandedItems.has(item.id) && (
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm line-clamp-2">
                  {item.content}
                </div>
              )}
              {expandedItems.has(item.id) && (
                <div className="mt-4 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
                  {item.content}
                </div>
              )}

              {/* Session Info */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Session: <span className="text-slate-700 dark:text-slate-300">{item.sessionTitle}</span></span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{item.submitterId ? 'Submitted by you' : 'Submitted by peer'}</span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Given to: <span className="text-slate-700 dark:text-slate-300">{item.targetUserName}</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
