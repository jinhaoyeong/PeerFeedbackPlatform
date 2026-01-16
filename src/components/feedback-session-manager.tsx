'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare,
  Calendar,
  Clock,
  Users,
  Settings,
  Play,
  Pause,
  Square,
  Plus,
  Edit,
  Trash2,
  Copy,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  Loader2,
  RefreshCw,
  Download,
  Bell
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/components/auth-provider'
import { FeedbackForm } from '@/components/feedback-form'

interface FeedbackSession {
  id: string
  title: string
  description?: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  startTime?: Date
  endTime?: Date
  participantCount: number
  feedbackCount: number
  targetUsers: Array<{
    id: string
    name: string
    email: string
    feedbackGiven: boolean
  }>
  settings: {
    allowAnonymous: boolean
    minFeedbackLength: number
    maxFeedbackLength: number
    autoClose: boolean
    reminderFrequency: 'none' | 'daily' | 'twice_daily'
  }
  allowSelfFeedback?: boolean
  createdAt: Date
  createdBy: string
}

interface FeedbackSessionManagerProps {
  groupId: string
  groupName: string
  groupMembers: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
  onSessionCreate?: (session: FeedbackSession) => void
  onSessionUpdate?: (sessionId: string, updates: Partial<FeedbackSession>) => void
}

export function FeedbackSessionManager({
  groupId,
  groupName,
  groupMembers,
  onSessionCreate,
  onSessionUpdate
}: FeedbackSessionManagerProps) {
  const [sessions, setSessions] = useState<FeedbackSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedSession, setSelectedSession] = useState<FeedbackSession | null>(null)
  const [editingSession, setEditingSession] = useState<FeedbackSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user, token } = useAuth()

  // Debug log for groupMembers
  console.log('FeedbackSessionManager - groupMembers:', groupMembers)
  console.log('FeedbackSessionManager - user:', user?.id)
  const isAdmin = (() => {
    try {
      if (!user?.id) return false
      return (groupMembers || []).some(m => m.id === user.id && (m.role === 'ADMIN' || m.role === 'OWNER'))
    } catch {
      return false
    }
  })()

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.getSessions(groupId)
        console.log('Raw API Response from /feedback/sessions:', response)
        console.log('Response type:', typeof response)
        console.log('Response.sessions:', (response as any)?.sessions)

        // Check if response has sessions property
        const sessionsData = (response as any)?.sessions || response || []
        console.log('Sessions data after extraction:', sessionsData)
        console.log('Is array?', Array.isArray(sessionsData))

        if (Array.isArray(sessionsData)) {
          setSessions(sessionsData.map((session: any) => {
            console.log('Processing session:', session)
            console.log('Session ID:', session.id)

            // Ensure session has an ID
            if (!session.id) {
              console.error('Session found without ID:', session)
              // Skip sessions without ID to prevent errors
              return null
            }

            const uniqueTargets = Array.isArray(session.submissions)
              ? Array.from(
                  new Map(
                    session.submissions
                      .filter((x: any) => x?.targetUser?.id)
                      .map((x: any) => [x.targetUser.id, x.targetUser])
                  ).values()
                ).map((u: any) => ({
                  id: u.id,
                  name: u.fullName || u.username || 'Member',
                  email: u.email || '',
                  feedbackGiven: true
                }))
              : []

            return {
              ...session,
              targetUsers: uniqueTargets,
              startTime: session.startTime ? new Date(session.startTime) : undefined,
              endTime: session.endTime ? new Date(session.endTime) : undefined,
              createdAt: new Date(session.createdAt),
              settings: {
                allowAnonymous: session.settings?.allowAnonymous ?? true,
                minFeedbackLength: session.settings?.minFeedbackLength ?? 50,
                maxFeedbackLength: session.settings?.maxFeedbackLength ?? 1000,
                autoClose: session.settings?.autoClose ?? false,
                reminderFrequency: session.settings?.reminderFrequency ?? 'none'
              },
              allowSelfFeedback: session.allowSelfFeedback ?? false
            }
          }).filter(Boolean)) // Remove null sessions
        } else {
          console.error('Invalid sessions response:', sessionsData)
          setSessions([])
        }
      } catch (err) {
        console.error('Failed to fetch sessions:', err)
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [groupId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/20'
      case 'DRAFT':
        return 'bg-amber-100 text-amber-700 ring-1 ring-amber-500/20'
      case 'CLOSED':
        return 'bg-slate-100 text-slate-700 ring-1 ring-slate-500/20'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-3.5 w-3.5" />
      case 'DRAFT':
        return <Clock className="h-3.5 w-3.5" />
      case 'CLOSED':
        return <Square className="h-3.5 w-3.5" />
      default:
        return <AlertCircle className="h-3.5 w-3.5" />
    }
  }

  const createSession = async (sessionData: any) => {
    try {
      const response = await apiClient.createSession({
        groupId,
        title: sessionData.title,
        description: sessionData.description,
        startsAt: sessionData.startTime,
        endsAt: sessionData.endTime,
        allowSelfFeedback: sessionData.allowSelfFeedback === true,
        allowAnonymousFeedback: sessionData.settings?.allowAnonymous ?? true,
        notifyOnCreate: sessionData.notifyOnCreate === true
      })

      if ((response as any)?.session) {
        const newSession = {
          ...(response as any).session,
          startTime: (response as any).session.startsAt ? new Date((response as any).session.startsAt) : undefined,
          endTime: (response as any).session.endsAt ? new Date((response as any).session.endsAt) : undefined,
          createdAt: new Date((response as any).session.createdAt),
          settings: {
            allowAnonymous: sessionData.settings?.allowAnonymous ?? true,
            minFeedbackLength: sessionData.settings?.minFeedbackLength ?? 50,
            maxFeedbackLength: sessionData.settings?.maxFeedbackLength ?? 1000,
            autoClose: sessionData.settings?.autoClose ?? false,
            reminderFrequency: sessionData.settings?.reminderFrequency ?? 'none'
          },
          allowSelfFeedback: (response as any).session?.allowSelfFeedback ?? false
        }
        setSessions(prev => [...prev, newSession])
        onSessionCreate?.(newSession)
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      throw error
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required for deletion')
      }
      console.log('Deleting session:', sessionId)
      await apiClient.updateSessionStatus(sessionId, 'ARCHIVED')
      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
    }
  }

  const duplicateSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/feedback/sessions/${sessionId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as any)?.message || 'Failed to duplicate session')
      }

      const data = await response.json()
      const newSession = (data as any)?.session
      if (newSession?.id) {
        setSessions(prev => [
          {
            ...newSession,
            startTime: newSession.startsAt ? new Date(newSession.startsAt) : undefined,
            endTime: newSession.endsAt ? new Date(newSession.endsAt) : undefined,
            createdAt: new Date(newSession.createdAt),
            settings: {
              allowAnonymous: true,
              minFeedbackLength: 50,
              maxFeedbackLength: 1000,
              autoClose: false,
              reminderFrequency: 'none'
            },
            allowSelfFeedback: newSession.allowSelfFeedback ?? false
          } as FeedbackSession,
          ...prev
        ])
      }
    } catch (error) {
      console.error('Failed to duplicate session:', error)
      const original = sessions.find(s => s.id === sessionId)
      if (original) {
        const copyId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${sessionId}-copy-${Math.floor(Math.random()*100000)}`
        const localCopy: FeedbackSession = {
          ...original,
          id: copyId,
          title: `${original.title} (Copy)`,
          status: 'DRAFT',
          startTime: undefined,
          endTime: undefined,
          createdAt: new Date()
        }
        setSessions(prev => [localCopy, ...prev])
      } else {
        alert((error as any)?.message || 'Failed to duplicate session')
      }
    }
  }

  const exportSession = async (sessionId: string, title: string) => {
    try {
      const response = await fetch(`/api/feedback/sessions/${sessionId}/export`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as any)?.message || 'Failed to export session')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(title || 'session').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export session:', error)
      const s = sessions.find(x => x.id === sessionId)
      if (s) {
        const rows: string[] = []
        rows.push('id,title,status,startTime,endTime,participantCount,feedbackCount')
        rows.push([
          s.id,
          JSON.stringify(s.title),
          s.status,
          s.startTime ? s.startTime.toISOString() : '',
          s.endTime ? s.endTime.toISOString() : '',
          String(s.participantCount || 0),
          String(s.feedbackCount || 0)
        ].join(','))
        rows.push('targetUserId,targetUserName')
        for (const tu of (s.targetUsers || [])) {
          rows.push([tu.id, JSON.stringify(tu.name || 'Member')].join(','))
        }
        const csv = rows.join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(title || 'session').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert((error as any)?.message || 'Failed to export session')
      }
    }
  }

  const startSession = async (sessionId: string) => {
    try {
      console.log('\n=== startSession called ===')
      console.log('Received sessionId:', sessionId)
      console.log('sessionId type:', typeof sessionId)
      console.log('Current sessions state:', sessions)

      if (!sessionId) {
        const error = new Error('Session ID is required to start a session')
        console.error('❌ Session ID validation failed:', error)
        setError(error.message)
        return
      }

      // Verify session exists before trying to update
      const session = sessions.find(s => s.id === sessionId)
      console.log('Found session in local state:', session)

      if (!session) {
        const error = new Error(`Session with ID ${sessionId} not found in local state`)
        console.error('❌ Session not found in local state:', error)
        console.error('Available session IDs:', sessions.map(s => s.id))
        setError(error.message)
        return
      }

      console.log('✅ About to call API with sessionId:', sessionId)
      await apiClient.updateSessionStatus(sessionId, 'ACTIVE')
      updateSessionLocal(sessionId, {
        status: 'ACTIVE',
        startTime: new Date()
      })

      // Clear any previous errors
      setError(null)
      console.log('✅ Session started successfully!')
    } catch (error) {
      console.error('❌ Failed to start session:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session'
      setError(errorMessage)
    }
  }

  const pauseSession = async (sessionId: string) => {
    try {
      await apiClient.updateSessionStatus(sessionId, 'DRAFT')
      updateSessionLocal(sessionId, { status: 'DRAFT' })
    } catch (error) {
      console.error('Failed to pause session:', error)
      throw error
    }
  }

  const closeSession = async (sessionId: string) => {
    try {
      await apiClient.updateSessionStatus(sessionId, 'CLOSED')
      updateSessionLocal(sessionId, {
        status: 'CLOSED',
        endTime: new Date()
      })
    } catch (error) {
      console.error('Failed to close session:', error)
      throw error
    }
  }

  const extendSession = async (sessionId: string) => {
    try {
      // Extend session by 7 days from now
      const newEndsAt = new Date()
      newEndsAt.setDate(newEndsAt.getDate() + 7)

      const response = await apiClient.extendSession(sessionId, newEndsAt)
      updateSessionLocal(sessionId, {
        status: 'ACTIVE',
        endTime: newEndsAt
      })

      // Refresh sessions to get latest data
      const sessionsResponse = await apiClient.getSessions(groupId)
      const sessionsData = (sessionsResponse as any)?.sessions || sessionsResponse || []
      if (Array.isArray(sessionsData)) {
        setSessions(sessionsData)
      }

      alert('Session extended by 7 days!')
    } catch (error) {
      console.error('Failed to extend session:', error)
      alert('Failed to extend session. Please try again.')
    }
  }

  const updateSessionLocal = (sessionId: string, updates: Partial<FeedbackSession>) => {
    const updatedSessions = sessions.map(session =>
      session.id === sessionId ? { ...session, ...updates } : session
    )
    setSessions(updatedSessions)
    onSessionUpdate?.(sessionId, updates)
  }

  const copySessionLink = (sessionId: string) => {
    const link = `${window.location.origin}/feedback/session/${sessionId}`
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(link)
        return
      }
    } catch {}
    try {
      const ta = document.createElement('textarea')
      ta.value = link
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (e) {
      alert('Unable to copy link. Link: ' + link)
    }
  }

  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null)
  const [feedbackSessionTitle, setFeedbackSessionTitle] = useState<string>('')
  const [feedbackTargetId, setFeedbackTargetId] = useState<string>('')
  const [feedbackTargetName, setFeedbackTargetName] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800 shadow-xl rounded-xl overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5">
      {/* Header */}
      <div className="p-6 border-b border-slate-100/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-blue-50 dark:bg-indigo-900/20 rounded-xl">
              <MessageSquare className="h-6 w-6 text-blue-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Feedback Sessions</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage feedback sessions for {groupName}</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-indigo-900/20 hover:-translate-y-0.5 font-medium"
            >
              <Plus className="h-5 w-5" />
              <span>Create Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-16 bg-white/30 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-lg inline-block mb-4">
              <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Loading sessions...</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Please wait while we fetch your sessions</p>
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-dashed border-red-200 dark:border-red-800">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-lg inline-block mb-4">
              <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Failed to load sessions</h4>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-medium transition-colors shadow-sm"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-none inline-block mb-6 transform rotate-3">
              <MessageSquare className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No feedback sessions yet</h4>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Create your first feedback session to start collecting valuable insights from your team.</p>
            {isAdmin ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-indigo-900/20 hover:-translate-y-0.5 font-medium"
              >
                <Plus className="h-5 w-5" />
                <span>Create First Session</span>
              </button>
            ) : (
              <div className="text-slate-500 dark:text-slate-400 text-sm">Only group admins can create sessions</div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="group border border-slate-100 dark:border-slate-800 rounded-2xl p-6 bg-white/50 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all hover:shadow-lg hover:border-indigo-100 dark:hover:border-indigo-900">
                {/* Session Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{session.title}</h4>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                        <div className="flex items-center space-x-1.5">
                          {getStatusIcon(session.status)}
                          <span>{session.status}</span>
                        </div>
                      </span>
                    </div>
                    {session.description && (
                      <p className="text-slate-600 dark:text-slate-400 mb-3 text-sm">{session.description}</p>
                    )}
                    <div className="flex items-center space-x-6 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span>{session.participantCount} participants</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MessageSquare className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span>{session.feedbackCount} feedback items</span>
                      </div>
                      {session.startTime && (
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span>Started {session.startTime.toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1 ml-4 opacity-80 group-hover:opacity-100 transition-opacity">
                    {isAdmin && session.status === 'DRAFT' && (
                      <button
                        onClick={() => {
                          if ((groupMembers || []).length < 3) {
                            alert('At least 3 group members are required to start a session')
                            return
                          }
                          console.log('Button clicked. Session ID:', session.id)
                          console.log('Full session object:', session)
                          if (!session.id) {
                            console.error('Session ID is undefined! Session:', session)
                            alert('Error: Session ID is missing. Please refresh the page and try again.')
                            return
                          }
                          startSession(session.id)
                        }}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Start session (requires at least 3 members)"
                        disabled={(groupMembers || []).length < 3}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && session.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => pauseSession(session.id)}
                          className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg hover:shadow-sm transition-all"
                          title="Pause session"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => closeSession(session.id)}
                          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:shadow-sm transition-all"
                          title="Close session"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEditingSession(session)}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg hover:shadow-sm transition-all"
                          title="Edit session"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {(session.status === 'ACTIVE' || session.status === 'CLOSED') && (
                          <button
                            onClick={() => extendSession(session.id)}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg hover:shadow-sm transition-all"
                            title="Extend session by 7 days"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => copySessionLink(session.id)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg hover:shadow-sm transition-all"
                      title="Copy session link"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDuplicateConfirm({ id: session.id, title: session.title })}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:shadow-sm transition-all"
                        title="Duplicate session"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => exportSession(session.id, session.title)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:shadow-sm transition-all"
                      title="Export session"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedSession(session)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:shadow-sm transition-all"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isAdmin && session.status === 'DRAFT' && (
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg hover:shadow-sm transition-all"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {session.status === 'ACTIVE' && session.participantCount > 0 && (
                  <div className="mb-4 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <span className="font-medium">Participation Progress</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round((session.feedbackCount / session.participantCount) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${(session.feedbackCount / session.participantCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Session Settings */}
                {session.settings && (
                  <div className="flex items-center space-x-6 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {session.settings.allowAnonymous && (
                      <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        <span>Anonymous</span>
                      </div>
                    )}
                    {session.settings.autoClose && (
                      <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        <Clock className="h-3 w-3 text-indigo-500" />
                        <span>Auto-close</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span>{session.settings.minFeedbackLength}-{session.settings.maxFeedbackLength} chars</span>
                    </div>
                  </div>
                )}

                {session.status === 'ACTIVE' && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const others = (groupMembers || []).filter(m => m.id !== user?.id)
                        const defaultTarget = others[0]
                        if (defaultTarget) {
                          setFeedbackTargetId(defaultTarget.id)
                          setFeedbackTargetName(defaultTarget.name || 'Member')
                        } else if (session.allowSelfFeedback && user?.id) {
                          setFeedbackTargetId(user.id)
                          setFeedbackTargetName(user.fullName || 'Me')
                        } else {
                          return
                        }
                        setFeedbackSessionId(session.id)
                        setFeedbackSessionTitle(session.title)
                        setShowFeedbackModal(true)
                      }}
                      disabled={((groupMembers || []).filter(m => m.id !== user?.id).length === 0) && !session.allowSelfFeedback}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-100 dark:border-indigo-800"
                      title="Give Feedback"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Give Feedback</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedSession.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Session Info */}
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-200 mb-4 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-indigo-500" />
                    Session Information
                  </h4>
                  <dl className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div>
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</dt>
                      <dd>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full inline-block ${getStatusColor(selectedSession.status)}`}>
                          {selectedSession.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Description</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300">{selectedSession.description || 'No description provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Created</dt>
                      <dd className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedSession.createdAt.toLocaleDateString()}</dd>
                    </div>
                    {selectedSession.startTime && (
                      <div>
                        <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Started</dt>
                        <dd className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedSession.startTime.toLocaleString()}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Participants */}
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-200 mb-4 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-indigo-500" />
                    Participants <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{(selectedSession?.targetUsers?.length || 0)}</span>
                  </h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {(selectedSession?.targetUsers?.length || 0) === 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400">No participants added yet</p>
                      </div>
                    ) : (
                      (selectedSession?.targetUsers || []).map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-100 dark:hover:border-indigo-900 hover:shadow-sm transition-all">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-200">{user.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.feedbackGiven
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          }`}>
                            {user.feedbackGiven ? 'Submitted' : 'Pending'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                >
                  Close
                </button>
                <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:-translate-y-0.5 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Session Modal */}
      {(showCreateForm || editingSession) && mounted && createPortal(
        <SessionForm
          session={editingSession}
          groupMembers={groupMembers}
          onClose={() => {
            setShowCreateForm(false)
            setEditingSession(null)
          }}
          onSubmit={async (sessionData) => {
            try {
              if (editingSession) {
                updateSessionLocal(editingSession.id, sessionData)
              } else {
                await createSession(sessionData)
              }
              setShowCreateForm(false)
              setEditingSession(null)
            } catch (error) {
              console.error('Failed to save session:', error)
            }
          }}
        />,
        document.body
      )}

      {showFeedbackModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Give Feedback</h2>
              <button onClick={() => setShowFeedbackModal(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select recipient</label>
              <select
                value={feedbackTargetId}
                onChange={(e) => {
                  const id = e.target.value
                  const m = (groupMembers || []).find(x => x.id === id)
                  setFeedbackTargetId(id)
                  setFeedbackTargetName(m ? (m.name || 'Member') : '')
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900"
              >
                {(groupMembers || []).filter(m => {
                  const s = sessions.find(x => x.id === feedbackSessionId)
                  return s?.allowSelfFeedback ? true : (m.id !== user?.id)
                }).map(m => (
                  <option key={m.id} value={m.id}>{m.name || 'Member'}</option>
                ))}
              </select>

              <FeedbackForm
                sessionId={feedbackSessionId!}
                targetUserId={feedbackTargetId}
                targetUserName={feedbackTargetName}
                sessionTitle={feedbackSessionTitle}
                allowAnonymous={((sessions.find(x => x.id === feedbackSessionId) as any)?.settings?.allowAnonymous) ?? true}
                onSubmit={async (text: string) => {
                  await apiClient.submitFeedback({ sessionId: feedbackSessionId!, targetUserId: feedbackTargetId, content: text })
                  setShowFeedbackModal(false)
                  const response = await apiClient.getSessions(groupId)
                  if ((response as any)?.sessions) {
                    setSessions((response as any).sessions.map((session: any) => {
                      const uniqueTargets = Array.isArray(session.submissions)
                        ? Array.from(
                            new Map(
                              session.submissions
                                .filter((x: any) => x?.targetUser?.id)
                                .map((x: any) => [x.targetUser.id, x.targetUser])
                            ).values()
                          ).map((u: any) => ({
                            id: u.id,
                            name: u.fullName || u.username || 'Member',
                            email: u.email || '',
                            feedbackGiven: true
                          }))
                        : []

                      return {
                        ...session,
                        targetUsers: uniqueTargets,
                        startTime: session.startTime ? new Date(session.startTime) : undefined,
                        endTime: session.endTime ? new Date(session.endTime) : undefined,
                        createdAt: new Date(session.createdAt),
                        settings: {
                          allowAnonymous: session.settings?.allowAnonymous ?? true,
                          minFeedbackLength: session.settings?.minFeedbackLength ?? 50,
                          maxFeedbackLength: session.settings?.maxFeedbackLength ?? 1000,
                          autoClose: session.settings?.autoClose ?? false,
                          reminderFrequency: session.settings?.reminderFrequency ?? 'none'
                        }
                      }
                    }))
                  }
                }}
                onCancel={() => setShowFeedbackModal(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {duplicateConfirm && mounted && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Duplicate Session</h2>
              <button onClick={() => setDuplicateConfirm(null)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-slate-700 dark:text-slate-300">Create a copy of "{duplicateConfirm.title}"?</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDuplicateConfirm(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { duplicateSession(duplicateConfirm.id); setDuplicateConfirm(null) }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Create Copy
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Session Form Component
interface SessionFormProps {
  session?: FeedbackSession | null
  groupMembers: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
  onClose: () => void
  onSubmit: (sessionData: Partial<FeedbackSession>) => void
}

export function SessionForm({ session, groupMembers, onClose, onSubmit }: SessionFormProps) {
  type SessionFormData = {
    title: string
    description: string
    targetUsers: string[]
    allowSelfFeedback: boolean
    startTime?: Date
    endTime?: Date
    hasEndDate: boolean
    notifyOnCreate: boolean
    settings: {
      allowAnonymous: boolean
      minFeedbackLength: number
      maxFeedbackLength: number
      autoClose: boolean
      reminderFrequency: 'none' | 'daily' | 'twice_daily'
    }
  }

  const [formData, setFormData] = useState<SessionFormData>({
    title: session?.title || '',
    description: session?.description || '',
    targetUsers: session?.targetUsers?.map(u => u.id) || [],
    allowSelfFeedback: (session as any)?.allowSelfFeedback ?? true,
    startTime: (session as any)?.startTime ?? undefined,
    endTime: (session as any)?.endTime ?? undefined,
    hasEndDate: !!(session as any)?.endTime,
    notifyOnCreate: false,
    settings: session?.settings ? {
      allowAnonymous: Boolean((session as any)?.settings?.allowAnonymous),
      minFeedbackLength: (session as any)?.settings?.minFeedbackLength ?? 50,
      maxFeedbackLength: (session as any)?.settings?.maxFeedbackLength ?? 2500,
      autoClose: Boolean((session as any)?.settings?.autoClose ?? false),
      reminderFrequency: (session as any)?.settings?.reminderFrequency ?? 'daily'
    } : {
      allowAnonymous: true,
      minFeedbackLength: 50,
      maxFeedbackLength: 2500,
      autoClose: false,
      reminderFrequency: 'daily'
    }
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Session title is required'
    }

    if (formData.targetUsers.length < 3) {
      newErrors.targetUsers = 'Please select at least 3 participants'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const targetUsers = groupMembers
        .filter(member => formData.targetUsers.includes(member.id))
        .map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          feedbackGiven: false
        }))

      await onSubmit({
        ...formData,
        targetUsers
      })
    } catch (error) {
      console.error('Failed to save session:', error)
      setErrors({ submit: 'Failed to save session. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      targetUsers: prev.targetUsers.includes(userId)
        ? prev.targetUsers.filter(id => id !== userId)
        : [...prev.targetUsers, userId]
    }))
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                {session ? <Edit className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> : <Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
              </div>
              {session ? 'Edit Session' : 'Create New Session'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Session Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
                  errors.title ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
                placeholder="e.g., Q1 Product Review"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="Describe the purpose of this feedback session..."
              />
            </div>

            {/* Participants */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Participants (minimum 3) <span className="text-red-500">*</span>
              </label>
              <div className={`border rounded-xl max-h-48 overflow-y-auto custom-scrollbar transition-all ${
                errors.targetUsers ? 'border-red-300 dark:border-red-800 bg-red-50/10 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {groupMembers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No group members available</p>
                  </div>
                ) : (
                  groupMembers.map((member) => (
                    <div key={member.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.targetUsers.includes(member.id)}
                            onChange={() => toggleUserSelection(member.id)}
                            className="peer h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          member.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500/10' :
                          member.role === 'MODERATOR' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/10' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/10'
                        }`}>
                          {member.role}
                        </span>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {errors.targetUsers && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.targetUsers}
                </p>
              )}
              {groupMembers.length < 3 && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">Invite at least 3 members to this group to create a session.</p>
              )}
            </div>

            {/* Settings */}
            <div className="bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4 flex items-center">
                <Settings className="h-4 w-4 mr-2 text-indigo-500" />
                Session Settings
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <Bell className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Notify on Session Start</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Send invitations to selected participants</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.notifyOnCreate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        notifyOnCreate: e.target.checked
                      }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <Users className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Allow Anonymous Feedback</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Participants can submit without identity</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.settings.allowAnonymous}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, allowAnonymous: e.target.checked }
                      }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <Calendar className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">End Date</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Automatically end session on selected date</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.hasEndDate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hasEndDate: e.target.checked,
                        endTime: e.target.checked ? (prev.endTime ?? new Date()) : undefined
                      }))}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                  </label>
                </div>

                {formData.hasEndDate && (
                  <div className="pl-2">
                    <input
                      type="datetime-local"
                      value={formData.endTime ? new Date(formData.endTime).toISOString().slice(0,16) : ''}
                      min={new Date().toISOString().slice(0,16)}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        endTime: e.target.value ? new Date(e.target.value) : undefined
                      }))}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Feedback Length Limits (Characters)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="minLength" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">Minimum</label>
                      <input
                        id="minLength"
                        type="number"
                        value={formData.settings.minFeedbackLength}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, minFeedbackLength: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        min="1"
                      />
                    </div>
                    <div>
                      <label htmlFor="maxLength" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">Maximum</label>
                      <input
                        id="maxLength"
                        type="number"
                        value={formData.settings.maxFeedbackLength}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, maxFeedbackLength: parseInt(e.target.value) || 1000 }
                        }))}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errors.submit}</p>
            </div>
          )}

          <div className="mt-8 flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || formData.targetUsers.length < 3 || groupMembers.length < 3}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {session ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {session ? 'Update Session' : 'Create Session'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
