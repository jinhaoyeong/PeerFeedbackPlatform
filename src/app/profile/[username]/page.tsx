'use client'

import { useState, useEffect, use } from 'react'
import { useAuth } from '@/components/auth-provider'
import { UserCircle, Mail, Calendar, ArrowLeft, Shield, AlertTriangle } from 'lucide-react'
import { useSettings } from '@/components/settings-provider'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  email: string
  username: string
  fullName: string
  createdAt: string
  lastLoginAt: string | null
  _count: {
    feedbackGiven: number
    feedbackReceived: number
    groupsCreated: number
    groupMembers: number
  }
}

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const { user, token } = useAuth()
  const router = useRouter()
  const { formatDate } = useSettings()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [username, token])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`/api/users/${username}/profile`, {
        headers
      })
      
      const data = await response.json()

      if (response.ok) {
        setProfileData(data.user)
      } else {
        setError(data.message || 'Failed to load profile')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-800">
          <div className="bg-rose-100 dark:bg-rose-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            {error.includes('private') || error.includes('group member') ? (
              <Shield className="h-8 w-8 text-rose-600 dark:text-rose-400" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!profileData) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
              } else {
                router.push('/dashboard')
              }
            }}
            className="inline-flex items-center space-x-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white">
            <div className="flex items-center space-x-6">
              <div className="h-24 w-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-white/10">
                <UserCircle className="h-12 w-12 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{profileData.fullName}</h1>
                <p className="text-indigo-100 mt-1">@{profileData.username}</p>
                {/* Don't show email unless it's the user themselves or maybe based on stricter privacy? 
                    Usually public profiles hide email. Let's hide it for now to be safe. */}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-blue-600">
                  {profileData._count.feedbackGiven}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Feedback Given</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-indigo-600">
                  {profileData._count.feedbackReceived}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Feedback Received</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-indigo-600">
                  {profileData._count.groupsCreated}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Groups Created</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-violet-600">
                  {profileData._count.groupMembers}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Groups Joined</div>
              </div>
            </div>

            {/* Information Sections */}
            <div className="space-y-6">
              {/* Account Information */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                  <UserCircle className="h-5 w-5 mr-2 text-indigo-500" />
                  Account Information
                </h2>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-4">
                    <div className="w-28 text-sm font-medium text-slate-700 dark:text-slate-300">Member Since</div>
                    <div className="text-slate-900 dark:text-white flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                      {formatDate(new Date(profileData.createdAt))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-28 text-sm font-medium text-slate-700 dark:text-slate-300">Last Active</div>
                    <div className="text-slate-900 dark:text-white flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                      {profileData.lastLoginAt ? formatDate(new Date(profileData.lastLoginAt)) : '—'}
                    </div>
                  </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
