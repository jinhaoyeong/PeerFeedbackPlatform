'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Users,
  Calendar,
  MessageSquare,
  Settings,
  Star,
  TrendingUp,
  Clock,
  UserPlus,
  Hash,
  ChevronRight,
  MoreVertical,
  Copy,
  CheckCircle2,
  LogOut
} from 'lucide-react'
import { X, Loader2, BarChart3 } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { apiClient } from '@/lib/api-client'
import { FeedbackAnalyticsReal } from '@/components/feedback-analytics-real'
import { FeedbackForm } from '@/components/feedback-form'
import { FeedbackViewer } from '@/components/feedback-viewer'
import { useSettings } from '@/components/settings-provider'
import { useSocket } from '@/components/socket-provider'
import { useNotifications } from '@/components/notification-provider'
import { GroupSettingsPopup } from '@/components/group-settings-popup'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MemberActionsDropdown } from '@/components/member-actions-dropdown'
import { SessionActionsDropdown } from '@/components/session-actions-dropdown'
import { SessionForm } from '@/components/feedback-session-manager'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { useToast } from '@/components/hooks/use-toast'

interface GroupDetailsProps {
  group: {
    id: string
    name: string
    description?: string
    memberCount: number
    isActive: boolean
    createdAt: string
    creator: {
      fullName: string
    }
  }
  onBack: () => void
}

interface Member {
  id: string
  fullName: string
  username: string
  role: string
  joinedAt: string
}

interface Session {
  id: string
  title: string
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT'
  startsAt?: string
  endsAt?: string
  createdAt?: string
  updatedAt?: string
  participantCount: number
  feedbackCount: number
}

export function GroupDetails({ group, onBack }: GroupDetailsProps) {
  const { formatDate } = useSettings()
  const { user, token } = useAuth()
  const { joinGroup, onGroupMemberJoined, onGroupMemberLeft, notifyMemberLeftGroup, sendDirectMessage, onDirectMessage, onDirectMessageAck, onDirectMessageError } = useSocket()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'sessions'>('overview')
  const [details, setDetails] = useState<any>(group)
  const [members, setMembers] = useState<Member[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingGroup, setLoadingGroup] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [errorGroup, setErrorGroup] = useState<string | null>(null)
  const [errorSessions, setErrorSessions] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionDescription, setNewSessionDescription] = useState('')
  const [newSessionStartsAt, setNewSessionStartsAt] = useState('')
  const [newSessionEndsAt, setNewSessionEndsAt] = useState('')
  const [newAllowSelfFeedback, setNewAllowSelfFeedback] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null)
  const [feedbackSessionTitle, setFeedbackSessionTitle] = useState<string>('')
  const [feedbackTargetId, setFeedbackTargetId] = useState<string>('')
  const [feedbackTargetName, setFeedbackTargetName] = useState<string>('')
  const [feedbackSessionAllowAnonymous, setFeedbackSessionAllowAnonymous] = useState<boolean>(true)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionDetails, setSessionDetails] = useState<any>(null)
  const [loadingSessionDetails, setLoadingSessionDetails] = useState(false)
  const [errorSessionDetails, setErrorSessionDetails] = useState<string | null>(null)
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [leavingGroup, setLeavingGroup] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [analyticsSessionId, setAnalyticsSessionId] = useState<string | null>(null)
  const [editingSession, setEditingSession] = useState<any | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [chatRecipient, setChatRecipient] = useState<{ id: string, username?: string, fullName?: string } | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ id?: string, fromUserId: string, content: string, timestamp: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  
  // Session Feedback Viewing State
  const [viewingFeedbackSessionId, setViewingFeedbackSessionId] = useState<string | null>(null)
  const [sessionFeedback, setSessionFeedback] = useState<any[]>([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const totalFeedback = useMemo(() => {
    try {
      return sessions.reduce((sum, s) => sum + (s.feedbackCount || 0), 0)
    } catch {
      return 0
    }
  }, [sessions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false)
        if (showAnalytics) setShowAnalytics(false)
        if (selectedSessionId) { setSelectedSessionId(null); setSessionDetails(null) }
        if (showSettingsPopup) setShowSettingsPopup(false)
      }
    }
    if (showCreateModal || showAnalytics || selectedSessionId || showSettingsPopup) {
      window.addEventListener('keydown', onKey)
    }
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [showCreateModal, showAnalytics, selectedSessionId, showSettingsPopup])

  useEffect(() => {
    const onOpen = (e: any) => {
      try {
        const d = e.detail || {}
        const rec = { id: d.userId, username: d.username, fullName: d.fullName }
        setChatRecipient(rec)
        setShowChatModal(true)
        setChatLoading(true)
        ;(async () => {
          try {
            const res = await fetch(`/api/messages?withUserId=${rec.id}`, { credentials: 'include', headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } })
            const data = await res.json()
            const msgs = (data.messages || []).map((m: any) => ({ id: m.id, fromUserId: m.senderId, content: m.content, timestamp: m.createdAt }))
            setChatMessages(msgs)
          } catch {}
          finally { setChatLoading(false) }
        })()
      } catch {}
    }
    window.addEventListener('dm:open', onOpen as any)
    return () => window.removeEventListener('dm:open', onOpen as any)
  }, [])

  useEffect(() => {
    onDirectMessage((payload) => {
      try {
        if (!chatRecipient) return
        if (payload && payload.fromUserId === chatRecipient.id) {
          setChatMessages(prev => [...prev, { fromUserId: payload.fromUserId, content: payload.content, timestamp: payload.timestamp }])
        }
      } catch {}
    })
    onDirectMessageAck((payload) => {
      try {
        if (chatRecipient && payload && payload.toUserId === chatRecipient.id) {
          setChatMessages(prev => [...prev, { fromUserId: user?.id || '', content: payload.content, timestamp: payload.timestamp }])
        }
      } catch {}
    })
    onDirectMessageError((err) => {
      try {
        if (err?.code === 'blocked') {
          toast({ title: 'Messaging disabled', description: 'Recipient has disabled messaging', })
        }
      } catch {}
    })
  }, [onDirectMessage, onDirectMessageAck, onDirectMessageError, chatRecipient, user?.id, toast])

  useEffect(() => {
    if (!showChatModal || !chatRecipient) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?withUserId=${chatRecipient.id}`, { credentials: 'include', headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } })
        if (!res.ok) return
        const data = await res.json()
        const msgs = (data.messages || []).map((m: any) => ({ id: m.id, fromUserId: m.senderId, content: m.content, timestamp: m.createdAt }))
        setChatMessages(prev => {
          const seen = new Set(prev.map(x => `${x.fromUserId}:${x.timestamp}:${x.content}`))
          const merged = [...prev]
          for (const msg of msgs) {
            const key = `${msg.fromUserId}:${msg.timestamp}:${msg.content}`
            if (!seen.has(key)) merged.push(msg)
          }
          return merged
        })
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [showChatModal, chatRecipient, token])

  useEffect(() => {
    const load = async () => {
      if (!group?.id) {
        setErrorGroup('Invalid group ID')
        return
      }

      try {
        setLoadingGroup(true)
        setErrorGroup(null)
        if ((group as any)?.members) {
          const g = group as any
          setDetails(g)
          const mapped = (g.members || []).map((m: any) => ({
            id: m.user.id,
            fullName: m.user.fullName,
            username: m.user.username,
            role: m.role,
            joinedAt: m.joinedAt
          }))
          setMembers(mapped)
          return
        }
        const res = await apiClient.getGroup(group.id)

        // Check if response is empty (authentication issue)
        if (!res || Object.keys(res).length === 0) {
          setErrorGroup('Please log in to view group details')
          return
        }

        const g = (res as any)?.group || null
        if (g) {
          setDetails(g)
          const mapped = (g.members || []).map((m: any) => ({
            id: m.user.id,
            fullName: m.user.fullName,
            username: m.user.username,
            role: m.role,
            joinedAt: m.joinedAt
          }))
          setMembers(mapped)
        } else {
          setErrorGroup('Group not found or access denied')
        }
      } catch (e: any) {
        const errorMsg = e?.message || 'Failed to load group'
        if (errorMsg.includes('Authentication required')) {
          setErrorGroup('Please log in to view group details')
        } else if (errorMsg.includes('Group not found') || errorMsg.includes('Resource not found')) {
          setErrorGroup('This group does not exist or you do not have permission to view it')
        } else {
          setErrorGroup(errorMsg)
        }
      } finally {
        setLoadingGroup(false)
      }
    }
    load()
  }, [group.id])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const fetchAllowAnonymous = async () => {
      try {
        if (showFeedbackModal && feedbackSessionId) {
          const res = await apiClient.getSession(feedbackSessionId)
          const s = (res as any)?.session
          if (s && s.settings && typeof s.settings.allowAnonymous === 'boolean') {
            setFeedbackSessionAllowAnonymous(s.settings.allowAnonymous)
          } else {
            setFeedbackSessionAllowAnonymous(true)
          }
        }
      } catch {}
    }
    fetchAllowAnonymous()
  }, [showFeedbackModal, feedbackSessionId])

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoadingSessions(true)
        setErrorSessions(null)
        const res = await apiClient.getSessions(group.id)
        const list = (res as any)?.sessions || []
        const mapped: Session[] = list.map((s: any) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          startsAt: s.startsAt ? String(s.startsAt) : undefined,
          endsAt: s.endsAt ? String(s.endsAt) : undefined,
          createdAt: s.createdAt ? String(s.createdAt) : undefined,
          updatedAt: s.updatedAt ? String(s.updatedAt) : undefined,
          participantCount: Array.isArray(s.submissions)
            ? new Set(s.submissions.map((x: any) => x.targetUser?.id)).size
            : 0,
          feedbackCount: typeof s.submissionCount === 'number' ? s.submissionCount : (Array.isArray(s.submissions) ? s.submissions.length : 0)
        }))
        setSessions(mapped)
      } catch (e: any) {
        setErrorSessions(e?.message || 'Failed to load sessions')
      } finally {
        setLoadingSessions(false)
      }
    }
    loadSessions()
  }, [group.id])

  // Join the group room for real-time updates
  useEffect(() => {
    if (group?.id && user) {
      console.log('Joining group room for real-time updates:', group.id)
      joinGroup(group.id)
    }
  }, [group.id, user, joinGroup])

  // Listen for real-time member updates
  useEffect(() => {
    const handleMemberJoined = (data: { groupId: string, memberInfo: any, timestamp: string }) => {
      console.log('Received member joined event:', data)

      // Only update if it's for the current group
      if (data.groupId === group.id) {
        const { memberInfo } = data

        // Check if member is already in the list to avoid duplicates
        setMembers(prev => {
          const existingMember = prev.find(m => m.id === memberInfo.id)
          if (existingMember) {
            return prev // Member already exists, no update needed
          }

          const newMember: Member = {
            id: memberInfo.id,
            fullName: memberInfo.fullName,
            username: memberInfo.username,
            role: memberInfo.role || 'MEMBER',
            joinedAt: memberInfo.joinedAt || new Date().toISOString()
          }

          console.log('Adding new member to list:', newMember)
          return [...prev, newMember]
        })

        // Update member count
        setDetails((prev: any) => ({
          ...prev,
          memberCount: (prev?.memberCount || 0) + 1
        }))


      }
    }

    const handleMemberLeft = (data: { groupId: string, memberInfo: any, timestamp: string }) => {
      console.log('Received member left event:', data)

      // Only update if it's for the current group
      if (data.groupId === group.id) {
        const { memberInfo } = data

        // Remove member from the list
        setMembers(prev => {
          const updatedMembers = prev.filter(m => m.id !== memberInfo.id)
          console.log('Removing member from list:', memberInfo.id)
          return updatedMembers
        })

        // Update member count
        setDetails((prev: any) => ({
          ...prev,
          memberCount: Math.max(0, (prev?.memberCount || 0) - 1)
        }))
      }
    }

    onGroupMemberJoined(handleMemberJoined)
    onGroupMemberLeft(handleMemberLeft)

    // Cleanup
    return () => {
      // Note: Socket cleanup will happen automatically when component unmounts
    }
  }, [group.id, user, onGroupMemberJoined, onGroupMemberLeft, group.name])

  // Poll group details and members for near-real-time updates when sockets are unavailable
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        setLoadingGroup(true)
        const res = await fetch(`/api/groups/${group.id}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setDetails(data.group)
            const mapped = (data.group?.members || []).map((m: any) => ({
              id: m.user?.id || m.userId,
              fullName: m.user?.fullName || '',
              username: m.user?.username || '',
              role: m.role,
              joinedAt: m.joinedAt
            }))
            setMembers(mapped)
          }
        }
      } catch {}
      finally {
        setLoadingGroup(false)
      }
    }
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [group.id])

  const isAdmin = useMemo(() => {
    try {
      if (!details?.members || !user?.id) return false
      const me = details.members.find((m: any) => m.user?.id === user.id)
      return me?.role === 'ADMIN'
    } catch {
      return false
    }
  }, [details, user])

  const track = async (event: string, context?: any) => {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ event, context }),
        credentials: 'include'
      })
    } catch {}
  }

  const handleViewSessionFeedback = async (sessionId: string) => {
    track('GROUP_DETAILS_VIEW_SESSION_FEEDBACK_CLICK', { groupId: group.id, sessionId })
    setViewingFeedbackSessionId(sessionId)
    setLoadingFeedback(true)
    setErrorFeedback(null)
    setSessionFeedback([])
    
    // Switch to sessions tab to show the feedback interface
    setActiveTab('sessions')
    
    try {
      const res = await apiClient.getSessionFeedback(sessionId)
      const feedback = (res as any)?.feedback || []
      const title = sessions.find(s => s.id === sessionId)?.title || ''
      const formatted = feedback.map((f: any) => ({
        id: f.id,
        sessionId: f.sessionId,
        sessionTitle: title,
        content: f.content,
        sentiment: f.sentiment || 'NEUTRAL',
        submittedAt: String(f.submittedAt),
        isFlagged: !!f.isFlagged,
        flagReason: f.flagReason || undefined,
        submitterId: f.submitterId || undefined,
        targetUserId: f.targetUser?.id,
        targetUserName: f.targetUser?.fullName || f.targetUser?.username || 'Member'
      }))
      setSessionFeedback(formatted)
    } catch (e: any) {
      setErrorFeedback(e?.message || 'Failed to load feedback')
    } finally {
      setLoadingFeedback(false)
    }
  }

  const startSession = async (sessionId: string) => {
    try {
      await apiClient.updateSessionStatus(sessionId, 'ACTIVE')
      const res = await apiClient.getSessions(group.id)
      const list = (res as any)?.sessions || []
      const mapped: Session[] = list.map((s: any) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        startsAt: s.startsAt ? String(s.startsAt) : undefined,
        endsAt: s.endsAt ? String(s.endsAt) : undefined,
        createdAt: s.createdAt ? String(s.createdAt) : undefined,
        updatedAt: s.updatedAt ? String(s.updatedAt) : undefined,
        participantCount: Array.isArray(s.submissions)
          ? new Set([
              ...s.submissions.map((x: any) => x.targetUser?.id).filter(Boolean),
              ...s.submissions.map((x: any) => x.submitterId).filter(Boolean)
            ]).size
          : 0,
        feedbackCount: typeof s.submissionCount === 'number' ? s.submissionCount : (Array.isArray(s.submissions) ? s.submissions.length : 0)
      }))
      setSessions(mapped)
      setActiveTab('sessions')
      track('SESSION_START', { groupId: group.id, sessionId })
    } catch (e: any) {
      toast({ title: 'Failed to start session', description: e?.message || 'Please try again' })
    }
  }

  const handleStartSession = () => {
    track('GROUP_DETAILS_START_SESSION_CLICK', { groupId: group.id })
    if (!isAdmin) return
    setShowCreateModal(true)
  }

  const handleInviteMembers = async () => {
    track('GROUP_DETAILS_INVITE_MEMBERS_CLICK', { groupId: group.id })
    try {
      const code = details?.joinCode || details?.inviteCode || ''
      if (code) {
        try {
          await navigator.clipboard.writeText(code)
        } catch {
          const el = document.createElement('textarea')
          el.value = code
          el.setAttribute('readonly', '')
          el.style.position = 'absolute'
          el.style.left = '-9999px'
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        }
        setCopyNote('Join code copied to clipboard')
        setInviteCopied(true)
        setTimeout(() => setCopyNote(null), 2500)
        setTimeout(() => setInviteCopied(false), 1500)
      } else {
        setCopyNote('Join code not available')
        setTimeout(() => setCopyNote(null), 2500)
      }
    } catch {}
  }

  const handleLeaveGroup = () => {
    setShowLeaveConfirm(true)
  }

  const confirmLeaveGroup = async () => {
    try {
      setLeavingGroup(true)

      if (user) {
        notifyMemberLeftGroup(group.id, {
          id: user.id,
          fullName: user.fullName || user.username,
          username: user.username,
          email: user.email
        })
      }

      await apiClient.leaveGroup(group.id)

      track('GROUP_LEAVE', { groupId: group.id })

      toast({
        title: 'Left Group',
        description: `You left "${details?.name || group.name}"`
      })
      setShowLeaveConfirm(false)
      onBack()
    } catch (error: any) {
      console.error('Leave group error:', error)
      toast({
        title: 'Failed to leave group',
        description: error?.message || 'Please try again'
      })
    } finally {
      setLeavingGroup(false)
    }
  }

  const handleViewAnalytics = () => {
    track('GROUP_DETAILS_VIEW_ANALYTICS_CLICK', { groupId: group.id })
    setSelectedSessionId(null)
    setSessionDetails(null)
    setShowAnalytics(true)
  }

  const handleViewSessionDetails = async (id: string) => {
    track('GROUP_DETAILS_VIEW_SESSION_DETAILS_CLICK', { groupId: group.id, sessionId: id })
    try {
      setSelectedSessionId(id)
      setLoadingSessionDetails(true)
      setErrorSessionDetails(null)

      // First check if we have the session data locally from the sessions list
      const localSession = sessions.find(s => s.id === id)
      if (localSession) {
        // Use the local session data instead of making an API call
        setSessionDetails({
          id: localSession.id,
          title: localSession.title,
          status: localSession.status,
          startsAt: localSession.startsAt,
          endsAt: localSession.endsAt,
          createdAt: localSession.createdAt,
          updatedAt: localSession.updatedAt,
          participantCount: localSession.participantCount,
          feedbackCount: localSession.feedbackCount,
          submissionCount: localSession.feedbackCount
        })
        return
      }

      // If not found locally, fetch from API
      const res = await apiClient.getSession(id)
      const s = (res as any)?.session || null
      setSessionDetails(s)
    } catch (e: any) {
      setErrorSessionDetails(e?.message || 'Failed to load session details')
    } finally {
      setLoadingSessionDetails(false)
    }
  }

  const submitCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreatingSession(true)
      setCreateError(null)
      const payload = {
        groupId: group.id,
        title: newSessionTitle.trim(),
        description: newSessionDescription.trim() || undefined,
        startsAt: newSessionStartsAt ? new Date(newSessionStartsAt) : undefined,
        endsAt: newSessionEndsAt ? new Date(newSessionEndsAt) : undefined,
        allowSelfFeedback: newAllowSelfFeedback
      }
      const res = await apiClient.createSession(payload)
      const created = (res as any)?.session
      if (created) {
        const mapped: Session = {
          id: created.id,
          title: created.title,
          status: created.status,
          startsAt: created.startsAt ? String(created.startsAt) : undefined,
          endsAt: created.endsAt ? String(created.endsAt) : undefined,
          createdAt: created.createdAt ? String(created.createdAt) : undefined,
          updatedAt: created.updatedAt ? String(created.updatedAt) : undefined,
          participantCount: 0,
          feedbackCount: typeof created.submissionCount === 'number' ? created.submissionCount : 0
        }
        setSessions(prev => [mapped, ...prev])
        track('SESSION_CREATE', { groupId: group.id, sessionId: created.id })
        setShowCreateModal(false)
        setNewSessionTitle('')
        setNewSessionDescription('')
        setNewSessionStartsAt('')
        setNewSessionEndsAt('')
        setNewAllowSelfFeedback(false)
      }
    } catch (e: any) {
      setCreateError(e?.message || 'Failed to create session')
    } finally {
      setCreatingSession(false)
    }
  }

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase()
    switch (s) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
      case 'CLOSED':
      case 'COMPLETED':
        return 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      case 'DRAFT':
        return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    }
  }

  const getRoleColor = (role: string) => {
    // Simplified logic for consistent design system
    switch (role) {
      case 'ADMIN':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
      case 'MODERATOR':
        return 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
      case 'MEMBER':
        return 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    }
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-start space-x-4">
            <button
              onClick={onBack}
              className="mt-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
            >
              <ChevronRight className="h-6 w-6 rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{details?.name || group.name}</h1>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(group.isActive ? 'ACTIVE' : 'CLOSED')}`}>
                  {group.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                Created by <span className="font-medium text-slate-700 dark:text-slate-300">{group.creator.fullName}</span> • {new Date(group.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              aria-label="Open settings"
              onClick={() => setShowSettingsPopup(true)}
              className="p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Description & Stats in a Card */}
        {group.description && (
          <div className="mb-8">
            <p className="text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">{group.description}</p>
          </div>
        )}

        {/* Modern Tabs */}
        <div className="flex items-center space-x-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-fit mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'members'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            Members <span className="ml-1 opacity-60 text-xs">({details?.memberCount ?? group.memberCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'sessions'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            Sessions
          </button>
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {errorGroup && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-red-800">Error Loading Group</h3>
                <div className="mt-1 text-sm text-red-700 font-medium">
                  {errorGroup}
                </div>
                <div className="mt-3">
                  <button
                    onClick={onBack}
                    className="text-sm font-semibold text-red-700 hover:text-red-800 underline decoration-2 decoration-red-700/30 hover:decoration-red-800 transition-all"
                  >
                    Go back to groups
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!errorGroup && activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Stats */}
            <div className="lg:col-span-2 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-all">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Members</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{details?.memberCount ?? group.memberCount}</h3>
                  </div>
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-all">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Feedback</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{totalFeedback}</h3>
                  </div>
                  <div className="p-3 bg-green-50/50 dark:bg-green-900/20 rounded-xl">
                    <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              {/* Recent Sessions */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Sessions</h3>
                  <button
                    aria-label="View all recent sessions"
                    onClick={() => setActiveTab('sessions')}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {sessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{session.title}</h4>
                            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                              {session.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{session.participantCount} participants</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{session.feedbackCount} feedback</span>
                            </div>
                            {session.startsAt && (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <span>{new Date(session.startsAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          aria-label={`Enter session ${session.title}`}
                          onClick={() => {
                            handleViewSessionFeedback(session.id)
                          }}
                          disabled={session.status === 'DRAFT'}
                          className={`ml-4 p-2 rounded-lg transition-all ${session.status === 'DRAFT' ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                     <div className="p-12 text-center">
                        <div className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3">
                           <MessageSquare className="h-full w-full" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white">No sessions yet</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Get started by creating a new feedback session.</p>
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Side Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Quick Actions */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  {isAdmin && (
                    <button
                      aria-label="Start feedback session"
                      onClick={handleStartSession}
                      disabled={!isAdmin}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">Start Session</span>
                    </button>
                  )}
                  <button
                    aria-label="Invite members"
                    onClick={handleInviteMembers}
                    className={`w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl transition-all hover:shadow-sm ${inviteCopied ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                  >
                    {inviteCopied ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span className="font-medium">{inviteCopied ? 'Copied!' : 'Invite Members'}</span>
                  </button>
                  <button
                    aria-label="View analytics"
                    onClick={handleViewAnalytics}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-sm"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">View Analytics</span>
                  </button>
                  {!isAdmin && (
                    <button
                      aria-label="Leave group"
                      onClick={handleLeaveGroup}
                      disabled={leavingGroup}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-sm"
                    >
                      {leavingGroup ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      <span className="font-medium">{leavingGroup ? 'Leaving...' : 'Leave Group'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Join Code */}
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Group Join Code</h3>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-3 relative group">
                   <div className="flex items-center justify-between">
                    <code className="text-xl font-mono font-bold text-slate-800 dark:text-slate-200 tracking-wider">{details?.joinCode || details?.inviteCode || 'UNKNOWN'}</code>
                    <button
                      aria-label="Copy join code"
                      onClick={handleInviteMembers}
                      className={`p-2 rounded-lg transition-all ${inviteCopied ? 'text-green-600 dark:text-green-400 hover:bg-white dark:hover:bg-slate-800' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800'}`}
                      title={inviteCopied ? 'Copied!' : 'Copy Code'}
                    >
                      {inviteCopied ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                {copyNote && (
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2 font-medium flex items-center gap-1">
                     <CheckCircle2 className="h-3 w-3" /> {copyNote}
                  </p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Share this code with others to let them join this group instantly.
                </p>
              </div>
            </div>
          </div>
        )}

        {!errorGroup && activeTab === 'members' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Group Members</h3>
              <button
                aria-label="Invite members"
                onClick={handleInviteMembers}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow ${inviteCopied ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 dark:bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500'}`}
              >
                {inviteCopied ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span className="font-medium">{inviteCopied ? 'Copied!' : 'Invite Members'}</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                           <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-medium mr-3">
                              {(member.fullName || member.username || 'U').charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-white">{member.fullName || member.username || 'Unknown'}</div>
                              {member.username && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">@{member.username}</div>
                              )}
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {formatDate(member.joinedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {member.id !== (user?.id || '') && (
                          <MemberActionsDropdown
                            member={member}
                            currentUserId={user?.id || ''}
                            currentUserRole={isAdmin ? 'ADMIN' : 'MEMBER'}
                            groupId={group.id}
                            onUpdate={async () => {
                              const res = await apiClient.getGroup(group.id)
                              const g = (res as any)?.group || null
                              if (g) {
                                setDetails(g)
                                const mapped = (g.members || []).map((m: any) => ({
                                  id: m.user.id,
                                  fullName: m.user.fullName,
                                  username: m.user.username,
                                  role: m.role,
                                  joinedAt: m.joinedAt
                                }))
                                setMembers(mapped)
                              }
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!errorGroup && activeTab === 'sessions' && (
          viewingFeedbackSessionId ? (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex items-center space-x-4 mb-6">
                 <button
                   onClick={() => setViewingFeedbackSessionId(null)}
                   className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                 >
                   <ChevronRight className="h-5 w-5 rotate-180" />
                   <span className="font-medium">Back to Sessions</span>
                 </button>
               </div>
               
               {loadingFeedback ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                  </div>
               ) : errorFeedback ? (
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800">
                    {errorFeedback}
                  </div>
               ) : (
                  <FeedbackViewer 
                    feedback={sessionFeedback} 
                    userName={user?.fullName || user?.username || 'User'}
                  />
               )}
             </div>
          ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Feedback Sessions</h3>
              <button
                aria-label="Create session"
                onClick={() => setShowCreateModal(true)}
                disabled={!isAdmin}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Create Session</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingSessions && (
                <div className="col-span-full flex items-center justify-center py-10 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading sessions...
                </div>
              )}
              {errorSessions && (
                <div className="col-span-full flex items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800 shadow-sm">
                  <X className="h-5 w-5 mr-2 text-red-500" />
                  <span className="font-medium">{errorSessions}</span>
                </div>
              )}
              {!loadingSessions && !errorSessions && sessions.length === 0 && (
                 <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No sessions yet</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Create a new session to start gathering feedback.</p>
                 </div>
              )}
              {!loadingSessions && !errorSessions && sessions.map((session) => (
                <div key={session.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                    <SessionActionsDropdown
                      session={session}
                      isAdmin={isAdmin}
                      groupId={group.id}
                      onUpdate={async () => {
                        // Reload sessions
                        const res = await apiClient.getSessions(group.id)
                        const list = (res as any)?.sessions || []
                        const mapped: Session[] = list.map((s: any) => ({
                          id: s.id,
                          title: s.title,
                          status: s.status,
                          startsAt: s.startsAt ? String(s.startsAt) : undefined,
                          endsAt: s.endsAt ? String(s.endsAt) : undefined,
                          createdAt: s.createdAt ? String(s.createdAt) : undefined,
                          updatedAt: s.updatedAt ? String(s.updatedAt) : undefined,
                          participantCount: Array.isArray(s.submissions)
                            ? new Set([
                                ...s.submissions.map((x: any) => x.targetUser?.id).filter(Boolean),
                                ...s.submissions.map((x: any) => x.submitterId).filter(Boolean)
                              ]).size
                            : 0,
                          feedbackCount: typeof s.submissionCount === 'number' ? s.submissionCount : (Array.isArray(s.submissions) ? s.submissions.length : 0)
                        }))
                        setSessions(mapped)
                      }}
                      onEdit={async () => {
                        try {
                          const res = await apiClient.getSession(session.id)
                          const s: any = (res as any)?.session || res
                          const mapped: any = {
                            id: s.id,
                            title: s.title,
                            description: s.description || '',
                            status: s.status,
                            startTime: s.startsAt ? new Date(s.startsAt) : undefined,
                            endTime: s.endsAt ? new Date(s.endsAt) : undefined,
                            participantCount: Array.isArray(s.submissions)
                              ? new Set([
                                  ...s.submissions.map((x: any) => x.targetUser?.id).filter(Boolean),
                                  ...s.submissions.map((x: any) => x.submitterId).filter(Boolean)
                                ]).size
                              : 0,
                            feedbackCount: typeof s.submissionCount === 'number' ? s.submissionCount : (Array.isArray(s.submissions) ? s.submissions.length : 0),
                            targetUsers: (members || []).map(m => ({ id: m.id, name: m.fullName || m.username || 'Member', email: '', feedbackGiven: false })),
                            settings: { allowAnonymous: s.settings?.allowAnonymous !== false, minFeedbackLength: 50, maxFeedbackLength: 2500, autoClose: false, reminderFrequency: 'none' as const },
                            allowSelfFeedback: s.allowSelfFeedback === true,
                            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
                            createdBy: ''
                          }
                          setEditingSession(mapped)
                          setShowCreateModal(true)
                        } catch {
                          setEditingSession({ id: session.id, title: session.title, description: '', status: session.status, targetUsers: [], allowSelfFeedback: false, settings: { allowAnonymous: true, minFeedbackLength: 50, maxFeedbackLength: 2500, autoClose: false, reminderFrequency: 'none' as const }, participantCount: session.participantCount, feedbackCount: session.feedbackCount, createdAt: new Date(), createdBy: '' })
                          setShowCreateModal(true)
                        }
                      }}
                      onViewDetails={() => handleViewSessionDetails(session.id)}
                      onViewAnalytics={(sid: string) => {
                        setShowAnalytics(true)
                        setAnalyticsSessionId(sid)
                      }}
                    />
                  </div>

                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{session.title}</h4>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Users className="h-4 w-4 mr-2.5 text-slate-400 dark:text-slate-500" />
                      {session.participantCount} participants
                    </div>
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <MessageSquare className="h-4 w-4 mr-2.5 text-slate-400 dark:text-slate-500" />
                      {session.feedbackCount} feedback items
                    </div>
                    {session.startsAt && (
                      <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                        <Calendar className="h-4 w-4 mr-2.5 text-slate-400 dark:text-slate-500" />
                        {new Date(session.startsAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {session.status === 'ACTIVE' ? (
                    <div className="space-y-3">
                      <button
                        aria-label={`Give feedback for ${session.title}`}
                        onClick={() => {
                          const others = members.filter(m => m.id !== user?.id)
                          const defaultTarget = others[0]
                          setFeedbackTargetId(defaultTarget?.id || '')
                          setFeedbackTargetName(defaultTarget ? (defaultTarget.fullName || defaultTarget.username || 'Member') : '')
                          setFeedbackSessionId(session.id)
                          setFeedbackSessionTitle(session.title)
                          setShowFeedbackModal(true)
                        }}
                        disabled={members.filter(m => m.id !== user?.id).length === 0}
                        className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-100 dark:border-indigo-800"
                      >
                        Give Feedback
                      </button>
                      <button
                        aria-label={`View feedback for ${session.title}`}
                        onClick={() => handleViewSessionFeedback(session.id)}
                        className="w-full px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        View Feedback
                      </button>
                    </div>
                  ) : session.status === 'CLOSED' ? (
                    <button
                      aria-label={`View feedback for ${session.title}`}
                      onClick={() => handleViewSessionFeedback(session.id)}
                      className="w-full px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      View Session
                    </button>
                  ) : (
                    isAdmin ? (
                      <button
                        aria-label={`Start ${session.title}`}
                        onClick={() => startSession(session.id)}
                        className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        Start Session
                      </button>
                    ) : (
                      <button
                        aria-label={`Session ${session.title} is not started`}
                        disabled
                        className="w-full px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-xl"
                      >
                        Not Started
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
          )
        )}

        {showCreateModal && mounted && (typeof document !== 'undefined') && require('react-dom').createPortal(
          <SessionForm
            session={editingSession}
            groupMembers={(members || []).map(m => ({ id: m.id, name: m.fullName || m.username || 'Member', email: '', role: m.role }))}
            onClose={() => { setShowCreateModal(false); setEditingSession(null) }}
            onSubmit={async (sessionData: any) => {
              try {
                setCreatingSession(true)
                setCreateError(null)
                if (editingSession && editingSession.id) {
                  const updatePayload = {
                    title: sessionData.title?.trim() || '',
                    description: sessionData.description?.trim() || undefined,
                    allowSelfFeedback: !!sessionData.allowSelfFeedback,
                    allowAnonymousFeedback: sessionData.settings?.allowAnonymous ?? true
                  }
                  const res = await apiClient.updateSession(editingSession.id, updatePayload)
                  const updated = (res as any)?.session
                  if (updated) {
                    const mapped: any = {
                      id: updated.id,
                      title: updated.title,
                      status: updated.status,
                      startsAt: updated.startsAt ? String(updated.startsAt) : undefined,
                      endsAt: updated.endsAt ? String(updated.endsAt) : undefined,
                      createdAt: updated.createdAt ? String(updated.createdAt) : undefined,
                      updatedAt: updated.updatedAt ? String(updated.updatedAt) : undefined,
                      participantCount: Array.isArray(updated.submissions)
                        ? new Set(updated.submissions.map((x: any) => x.targetUser?.id)).size
                        : 0,
                      feedbackCount: typeof updated.submissionCount === 'number' ? updated.submissionCount : (Array.isArray(updated.submissions) ? updated.submissions.length : 0)
                    }
                    setSessions(prev => prev.map(s => s.id === mapped.id ? mapped : s))
                    setShowCreateModal(false)
                    setEditingSession(null)
                  }
                } else {
                  const payload = {
                    groupId: group.id,
                    title: sessionData.title?.trim() || '',
                    description: sessionData.description?.trim() || undefined,
                    startsAt: undefined,
                    endsAt: undefined,
                    allowSelfFeedback: !!sessionData.allowSelfFeedback,
                    allowAnonymousFeedback: sessionData.settings?.allowAnonymous ?? true
                  }
                  const res = await apiClient.createSession(payload)
                  const created = (res as any)?.session
                  if (created) {
                    const mapped: any = {
                      id: created.id,
                      title: created.title,
                      status: created.status,
                      startsAt: created.startsAt ? String(created.startsAt) : undefined,
                      endsAt: created.endsAt ? String(created.endsAt) : undefined,
                      createdAt: created.createdAt ? String(created.createdAt) : undefined,
                      updatedAt: created.updatedAt ? String(created.updatedAt) : undefined,
                      participantCount: 0,
                      feedbackCount: typeof created.submissionCount === 'number' ? created.submissionCount : 0
                    }
                    setSessions(prev => [mapped, ...prev])
                    setShowCreateModal(false)
                  }
                }
              } catch (e: any) {
                setCreateError(e?.message || 'Failed to create session')
              } finally {
                setCreatingSession(false)
              }
            }}
          />,
          document.body
        )}

        {showFeedbackModal && feedbackSessionId && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowFeedbackModal(false)} />
              <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                      <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 id="feedback-modal-title" className="text-xl font-semibold text-slate-900 dark:text-white">Give Feedback</h2>
                  </div>
                  <button onClick={() => setShowFeedbackModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Participant</label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Choose who you want to give feedback to.</p>
                    <Select
                      value={feedbackTargetId}
                      onValueChange={(id) => {
                        setFeedbackTargetId(id)
                        const m = members.find(x => x.id === id)
                        setFeedbackTargetName(m ? (m.fullName || m.username || 'Member') : '')
                      }}
                    >
                      <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Select a participant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {members.filter(m => m.id !== user?.id).map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {(m.fullName || m.username || 'Unknown')}{m.username ? ` (@${m.username})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FeedbackForm
                    sessionId={feedbackSessionId}
                    targetUserId={feedbackTargetId}
                    targetUserName={feedbackTargetName}
                    sessionTitle={feedbackSessionTitle}
                    allowAnonymous={feedbackSessionAllowAnonymous}
                    onSubmit={async (text: string) => {
                      await apiClient.submitFeedback({ sessionId: feedbackSessionId!, targetUserId: feedbackTargetId, content: text })
                      setShowFeedbackModal(false)
                      const res = await apiClient.getSessions(group.id)
                      const list = (res as any)?.sessions || []
                      const mapped: Session[] = list.map((s: any) => ({
                        id: s.id,
                        title: s.title,
                        status: s.status,
                        startsAt: s.startsAt ? String(s.startsAt) : undefined,
                        endsAt: s.endsAt ? String(s.endsAt) : undefined,
                        createdAt: s.createdAt ? String(s.createdAt) : undefined,
                        updatedAt: s.updatedAt ? String(s.updatedAt) : undefined,
                        participantCount: Array.isArray(s.submissions)
                          ? new Set(s.submissions.map((x: any) => x.targetUser?.id)).size
                          : 0,
                        feedbackCount: typeof s.submissionCount === 'number' ? s.submissionCount : (Array.isArray(s.submissions) ? s.submissions.length : 0)
                      }))
                      setSessions(mapped)
                    }}
                    onCancel={() => setShowFeedbackModal(false)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="analytics-title">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowAnalytics(false)} />
              <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                      <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 id="analytics-title" className="text-xl font-semibold text-slate-900 dark:text-white">Analytics</h2>
                  </div>
                  <button onClick={() => setShowAnalytics(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  <FeedbackAnalyticsReal sessionId={analyticsSessionId || undefined} />
                  </div>
              </div>
            </div>
          </div>
        )}

        {selectedSessionId && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="session-details-title">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => { setSelectedSessionId(null); setSessionDetails(null); }} />
              <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                      <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 id="session-details-title" className="text-xl font-semibold text-slate-900 dark:text-white">Session Details</h2>
                  </div>
                  <button onClick={() => { setSelectedSessionId(null); setSessionDetails(null); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  {loadingSessionDetails && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin mb-3 text-indigo-600 dark:text-indigo-400" />
                      <p>Loading session details...</p>
                    </div>
                  )}
                  {errorSessionDetails && (
                    <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
                      {errorSessionDetails}
                    </div>
                  )}
                  {!loadingSessionDetails && !errorSessionDetails && sessionDetails && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{sessionDetails.title}</h3>
                        <div className="flex items-center space-x-2">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(sessionDetails.status)}`}>
                              {sessionDetails.status}
                            </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center text-slate-500 dark:text-slate-400 mb-3">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span className="text-xs font-medium uppercase tracking-wider">Timeline</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Starts</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {sessionDetails.startsAt
                                  ? new Date(sessionDetails.startsAt).toLocaleString()
                                  : (sessionDetails.createdAt
                                    ? new Date(sessionDetails.createdAt).toLocaleString()
                                    : 'Not set')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ends</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {sessionDetails.endsAt
                                  ? new Date(sessionDetails.endsAt).toLocaleString()
                                  : 'Not set'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                           <div className="flex items-center text-slate-500 dark:text-slate-400 mb-3">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            <span className="text-xs font-medium uppercase tracking-wider">Activity</span>
                          </div>
                          <div className="space-y-3">
                             <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Feedback Submitted</p>
                              <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                                {typeof sessionDetails.submissionCount === 'number' ? sessionDetails.submissionCount : (Array.isArray(sessionDetails.submissions) ? sessionDetails.submissions.length : 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Popup */}
        <GroupSettingsPopup
          isOpen={showSettingsPopup}
          onClose={() => setShowSettingsPopup(false)}
          group={{
            ...details,
            id: group.id,
            name: details?.name || group.name,
            description: details?.description || group.description,
            isActive: details?.isActive ?? group.isActive,
            joinCode: details?.joinCode || details?.inviteCode,
            memberCount: details?.memberCount ?? group.memberCount
          }}
          isAdmin={isAdmin}
          onUpdate={(updatedGroup) => {
            setDetails((prev: any) => ({
              ...prev,
              ...updatedGroup
            }))
          }}
          onDelete={() => {
            onBack()
          }}
        />
      </div>
    </div>
    </div>

    <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Group?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to leave this group? You will need a new invite code to rejoin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leavingGroup}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmLeaveGroup} disabled={leavingGroup}>
            {leavingGroup ? 'Leaving...' : 'Leave Group'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {showChatModal && chatRecipient && (
      <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="chat-modal-title">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => { setShowChatModal(false); setChatRecipient(null); setChatMessages([]); }} />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 id="chat-modal-title" className="text-xl font-semibold text-slate-900 dark:text-white">Chat with {chatRecipient.fullName || chatRecipient.username || 'Member'}</h2>
              </div>
              <button onClick={() => { setShowChatModal(false); setChatRecipient(null); setChatMessages([]); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {chatLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading messages...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-6">No messages yet</div>
              ) : (
                chatMessages.map((m, idx) => (
                  <div key={`${m.timestamp}:${idx}`} className={`flex ${m.fromUserId === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm border ${m.fromUserId === user?.id ? 'bg-indigo-50 border-indigo-200 text-slate-900' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'}`}>
                      <div>{m.content}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(m.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                <button onClick={async () => {
                  const c = chatInput.trim()
                  if (!c || !chatRecipient) return
                  setChatInput('')
                  try { if (typeof sendDirectMessage === 'function') sendDirectMessage(chatRecipient.id, c) } catch {}
                  try {
                    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, credentials: 'include', body: JSON.stringify({ toUserId: chatRecipient.id, content: c }) })
                    let data: any = null
                    try { data = await res.json() } catch {}
                    if (res.status === 403) {
                      toast({ title: 'Messaging disabled', description: 'Recipient has disabled messaging' })
                      return
                    }
                    if (res.ok) {
                      const ts = data?.message?.createdAt ? String(data.message.createdAt) : new Date().toISOString()
                      setChatMessages(prev => [...prev, { fromUserId: user?.id || '', content: c, timestamp: ts }])
                      try {
                        const ref = await fetch(`/api/messages?withUserId=${chatRecipient.id}`, { credentials: 'include', headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } })
                        if (ref.ok) {
                          const refData = await ref.json()
                          const msgs = (refData.messages || []).map((m: any) => ({ id: m.id, fromUserId: m.senderId, content: m.content, timestamp: m.createdAt }))
                          setChatMessages(msgs)
                        }
                      } catch {}
                    } else {
                      const errText = (data && (data.message || data.error)) || 'Failed to send message'
                      toast({ title: 'Send failed', description: errText })
                    }
                  } catch {}
                }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
