'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useSettings } from '@/components/settings-provider'
import { useSocket } from '@/components/socket-provider'
import { useNotifications } from '@/components/notification-provider'
import { GroupModal } from '@/components/group-modal'
import { GroupDetails } from '@/components/group-details'
import { FeedbackAnalyticsReal } from '@/components/feedback-analytics-real'
import { CreateFeedbackSessionModal } from '@/components/create-feedback-session-modal'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
  MessageSquare,
  Users,
  TrendingUp,
  Settings,
  Plus,
  Search,
  Calendar,
  Star,
  AlertCircle,
  BarChart3,
  LogOut,
  User,
  Bell,
  Loader2
} from 'lucide-react'
import { FeedbackReceivedIcon, ActiveGroupsIcon } from '@/components/custom-icons'
import { useToast } from '@/components/hooks/use-toast'

interface DashboardStats {
  totalFeedbackReceived: number
  totalFeedbackGiven: number
  averageSentiment: string
  groupsCount: number
  recentActivity: Array<{
    id: string
    type: 'feedback_given' | 'feedback_received' | 'group_joined' | 'session_created'
    message: string
    timestamp: string
  }>
}

interface Group {
  id: string
  name: string
  description?: string
  memberCount: number
  isActive: boolean
  createdAt: string
  creator: {
    fullName: string
  }
  members?: any[]
}

export default function DashboardPage() {
  const { user, isAuthenticated, logout: authLogout } = useAuth()
  const { formatDate } = useSettings()
  const router = useRouter()
  const { joinGroup, onGroupMemberJoined, onGroupCreated, onGroupDeleted } = useSocket()
  const { notifications, unreadCount, refreshNotifications } = useNotifications()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      await apiClient.logout()
      authLogout()
    } catch (error) {
      console.error('Logout error:', error)
      // Still logout locally even if API fails
      authLogout()
    }
  }
  const [stats, setStats] = useState<DashboardStats>({
    totalFeedbackReceived: 0,
    totalFeedbackGiven: 0,
    averageSentiment: 'NEUTRAL',
    groupsCount: 0,
    recentActivity: []
  })
  const [groups, setGroups] = useState<Group[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Authentication guard - redirect unauthenticated users to landing page
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      console.log('Unauthenticated user trying to access dashboard, redirecting to landing page')
      router.push('/')
    }
  }, [isAuthenticated, loading, router])

  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create')
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showGroupDetails, setShowGroupDetails] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        if (!isAuthenticated) {
          setLoading(false)
          return
        }
        // Fetch dashboard stats and groups in parallel
        const [statsResponse, groupsResponse] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getGroups()
        ])

        if ((statsResponse as any).stats) {
          setStats((statsResponse as any).stats)
        }

        if ((groupsResponse as any).groups) {
          setGroups((groupsResponse as any).groups)
        }

        setLoading(false)
      } catch (error: any) {
        const msg = String(error?.message || '')
        if (!msg.toLowerCase().includes('authentication required')) {
          console.error('Failed to fetch dashboard data:', error)
        }

        // Set default values on error
        setStats({
          totalFeedbackReceived: 0,
          totalFeedbackGiven: 0,
          averageSentiment: 'NEUTRAL',
          groupsCount: 0,
          recentActivity: []
        })
        setGroups([])
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [isAuthenticated])

  // Join all group rooms after groups are loaded for real-time updates
  useEffect(() => {
    try {
      if (user && groups.length > 0) {
        groups.forEach(g => {
          joinGroup(g.id)
        })
      }
    } catch {}
  }, [user?.id, groups.map(g => g.id).join(':'), joinGroup])

  // Lightweight polling to keep dashboard fresh across browsers
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await apiClient.getGroups()
        const statsRes = await apiClient.getDashboardStats()
        if (!cancelled) {
          if ((res as any)?.groups) setGroups((res as any).groups)
          if ((statsRes as any)?.stats) setStats((statsRes as any).stats)
        }
      } catch {}
    }
    const interval = setInterval(poll, 4000)
    const onFocus = () => poll()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll()
    })
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [isAuthenticated])

  // Listen for real-time member join events and update UI + notifications
  useEffect(() => {
    const handleMemberJoined = async (data: { groupId: string, memberInfo: any, timestamp: string }) => {
      const { groupId, memberInfo } = data

      setGroups(prev => {
        const exists = prev.some(g => g.id === groupId)

        // If the current user just joined and the group is missing in list, refetch groups
        if (!exists && memberInfo?.id === user?.id) {
          console.log('Current user joined a new group, fetching updated list...')
          ;(async () => {
            try {
              const res = await apiClient.getGroups()
              if ((res as any)?.groups) {
                console.log('Fetched groups after join:', (res as any).groups.length)
                setGroups((res as any).groups)
                const statsRes = await apiClient.getDashboardStats()
                if ((statsRes as any)?.stats) {
                  setStats((statsRes as any).stats)
                }
              }
            } catch (error) {
              console.error('Failed to fetch groups after join:', error)
            }
          })()

          // Return the updated list
          return prev
        }

        // If group exists, update member count
        if (exists) {
          return prev.map(g => (
            g.id === groupId ? { ...g, memberCount: (g.memberCount || 0) + 1 } : g
          ))
        }

        return prev
      })

      if (memberInfo?.id !== user?.id) {
        try { await refreshNotifications() } catch {}

        const gName = (groups.find(g => g.id === groupId)?.name) || 'a group'
        toast({
          title: 'New Member Joined',
          description: `${memberInfo.fullName} joined ${gName}`,
        })

        setStats(prev => ({
          ...prev,
          recentActivity: [
            {
              id: `${groupId}:${memberInfo.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
              type: 'group_joined' as const,
              message: `${memberInfo.fullName} (@${memberInfo.username}) joined group`,
              timestamp: new Date().toISOString()
            },
            ...prev.recentActivity
          ].slice(0, 20)
        }))
      }
    }

    onGroupMemberJoined(handleMemberJoined)
  }, [onGroupMemberJoined, user?.id, refreshNotifications])

  // Listen for group created events
  useEffect(() => {
    const handleGroupCreated = async (data: { group: any, timestamp: string }) => {
      const { group } = data

      // If the current user created the group, add it to the list
      if (group && group.creatorId === user?.id) {
        setGroups(prev => {
          // Check if group already exists (avoid duplicates)
          const exists = prev.some(g => g.id === group.id)
          if (!exists) {
            console.log('Adding newly created group to list:', group.name)
            return [...prev, group]
          }
          return prev
        })

        // Update stats
        setStats(prev => ({
          ...prev,
          groupsCount: prev.groupsCount + 1
        }))
      }

      // Also refetch groups to ensure the list is up-to-date
      try {
        const res = await apiClient.getGroups()
        if ((res as any)?.groups) {
          setGroups((res as any).groups)
        }
        const statsRes = await apiClient.getDashboardStats()
        if ((statsRes as any)?.stats) {
          setStats((statsRes as any).stats)
        }
      } catch {}
    }

    onGroupCreated(handleGroupCreated)
  }, [onGroupCreated, user?.id])

  // Listen for group deleted events
  useEffect(() => {
    const handler = async (data: { groupId: string, timestamp: string }) => {
      const { groupId } = data
      setGroups(prev => prev.filter(g => g.id !== groupId))
      setStats(prev => ({
        ...prev,
        groupsCount: Math.max(0, prev.groupsCount - 1)
      }))
      try {
        const res = await apiClient.getGroups()
        if ((res as any)?.groups) setGroups((res as any).groups)
      } catch {}
    }
    onGroupDeleted(handler)
  }, [onGroupDeleted])

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fallback: Refresh groups/stats when a local event is dispatched (create/join)
  useEffect(() => {
    const handler = async (e: any) => {
      try {
        const detail = e?.detail || {}
        const type = detail?.type
        const g = detail?.group
        const gid = detail?.groupId || g?.id

        if (type === 'create' && g) {
          setGroups(prev => (prev.some(x => x.id === g.id) ? prev : [...prev, g]))
          setStats(prev => ({ ...prev, groupsCount: prev.groupsCount + 1 }))
        } else if (type === 'join' && g) {
          setGroups(prev => (prev.some(x => x.id === g.id) ? prev : [...prev, g]))
        } else if (type === 'delete' && gid) {
          setGroups(prev => prev.filter(x => x.id !== gid))
          setStats(prev => ({ ...prev, groupsCount: Math.max(0, prev.groupsCount - 1) }))
        }

        const res = await apiClient.getGroups()
        if ((res as any)?.groups) {
          setGroups((res as any).groups)
        }
        const statsRes = await apiClient.getDashboardStats()
        if ((statsRes as any)?.stats) {
          setStats((statsRes as any).stats)
        }
      } catch {}
    }
    window.addEventListener('groups:refresh', handler as any)
    return () => window.removeEventListener('groups:refresh', handler as any)
  }, [])

  

  if (showGroupDetails && selectedGroup) {
    return (
      <GroupDetails
        group={selectedGroup}
        onBack={() => {
          setShowGroupDetails(false)
          setSelectedGroup(null)
        }}
      />
    )
  }

  if (showAnalytics) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
        <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="flex items-center space-x-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-200"
                >
                  <span className="text-lg">←</span>
                  <span className="font-medium">Back to Dashboard</span>
                </button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Analytics</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FeedbackAnalyticsReal />
        </div>
      </div>
    )
  }

  

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <NotificationDropdown trigger={
                  <button className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200">
                    <Bell className="h-5 w-5" />
                  </button>
                } />
              </div>

              <div className="flex items-center">
                <ProfileDropdown trigger={
                  <button className="flex items-center space-x-3 p-2 pl-4 pr-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all duration-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                    <span className="hidden md:block font-semibold text-sm">{user?.fullName}</span>
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400">
                      <User className="h-4 w-4" />
                    </div>
                  </button>
                } />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Section */}
        <div className="mb-10">
          <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight flex items-center gap-3">
            Welcome back, {user?.fullName}! 
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-10 w-10 text-blue-600 dark:text-blue-400">
              <rect width="256" height="256" fill="none"/>
              <path d="M213.27,104,196,74a20,20,0,0,0-34.64,20l-30-52A20,20,0,0,0,96.65,62h0L89.73,50A20,20,0,0,0,55.08,70L69.32,94.67a20,20,0,0,0-34.64,20L74.7,184a80,80,0,0,0,138.57-80Z" opacity="0.2" fill="currentColor"/>
              <path d="M96.65,62a20,20,0,0,1,34.64-20l30,52" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <path d="M69.32,94.67,55.08,70A20,20,0,0,1,89.73,50l31.17,54" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <path d="M158.87,160A40,40,0,0,1,168,105.58L161.32,94A20,20,0,0,1,196,74l17.31,30A80,80,0,0,1,74.7,184l-40-69.32a20,20,0,0,1,34.64-20L88.57,128" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <path d="M192,33.78A51.84,51.84,0,0,1,223.67,58l.33.57" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <path d="M74.62,232A111.88,111.88,0,0,1,47,200" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
            </svg>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xl">
            Here's what's happening with your feedback journey.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FeedbackReceivedIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalFeedbackReceived}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Feedback Received</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalFeedbackGiven}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Feedback Given</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                <ActiveGroupsIcon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.groupsCount}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Active Groups</p>
          </div>

          
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Groups Section */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your Groups</h3>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowAnalytics(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors font-medium"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Analytics</span>
                    </button>
                    <button
                      onClick={() => {
                        setModalMode('create')
                        setShowModal(true)
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/20 font-medium"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Group</span>
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGroups.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-medium mb-1">No groups found</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Create your first feedback group to get started</p>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.id} className="p-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{group.name}</h4>
                            {group.isActive ? (
                              <span className="px-2.5 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700">
                                Inactive
                              </span>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{group.description}</p>
                          )}
                          <div className="flex items-center space-x-6 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                              <span>{group.memberCount} members</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>Created {formatDate(group.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          
                          <button
                            onClick={() => {
                              setSelectedGroup(group)
                              setShowGroupDetails(true)
                            }}
                            className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors shadow-sm"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                  <BarChart3 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
              </div>

              <div className="p-6">
                {stats.recentActivity.length === 0 ? (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {stats.recentActivity
                      .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)
                      .slice(0, showAllActivity ? 8 : 3)
                      .map((activity, idx, arr) => (
                      <div key={`${activity.id}:${idx}`} className="flex gap-4 relative pb-8 last:pb-0">
                        {/* Dot + Timeline Line */}
                        <div className="flex-shrink-0 mt-1.5 relative z-10 w-4 flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)] ring-4 ring-white dark:ring-slate-900" />
                          {idx !== arr.length - 1 && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-3 bottom-0 w-[2px] bg-slate-100 dark:bg-slate-800" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.message}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {activity.timestamp}
                          </p>
                        </div>
                      </div>
                    ))}
                    {stats.recentActivity.length > 3 && (
                      <div className="pt-4">
                        <button
                          onClick={() => setShowAllActivity(!showAllActivity)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                          {showAllActivity ? 'Show Less' : 'Show More'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowCreateSessionModal(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all duration-200 hover:-translate-y-0.5 font-medium"
                >
                  <Plus className="h-5 w-5" />
                  <span>Start Feedback Session</span>
                </button>
                <button
                  onClick={() => {
                    setModalMode('join')
                    setShowModal(true)
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 text-slate-700 dark:text-slate-300 font-medium hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md"
                >
                  <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  <span>Join Group</span>
                </button>
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 text-slate-700 dark:text-slate-300 font-medium hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md"
                >
                  <BarChart3 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  <span>View Analytics</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Group Modal */}
      <GroupModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        mode={modalMode}
      />

      {/* Create Feedback Session Modal */}
      <CreateFeedbackSessionModal
        isOpen={showCreateSessionModal}
        onClose={() => setShowCreateSessionModal(false)}
        onSuccess={(session) => {
          setShowCreateSessionModal(false)
          try {
            const gid = (session?.groupId) || (session?.group?.id)
            const g = groups.find((x) => x.id === gid)
            if (g) {
              setSelectedGroup(g)
              setShowGroupDetails(true)
            }
          } catch {}
        }}
      />
    </div>
  )
}
