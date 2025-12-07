'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { UserCircle, Mail, Calendar, Shield, Edit2, Save, X, ArrowLeft, QrCode, CheckCircle, AlertCircle } from 'lucide-react'
import { useSettings } from '@/components/settings-provider'
import { useRouter, useSearchParams } from 'next/navigation'

interface UserProfile {
  id: string
  email: string
  username: string
  fullName: string
  createdAt: string
  updatedAt: string
  _count: {
    feedbackGiven: number
    feedbackReceived: number
    groupsCreated: number
    groupMembers: number
  }
}

export default function ProfilePage() {
  const { user, token, twoFATempToken } = useAuth()
  const router = useRouter()
  const search = useSearchParams()
  const { formatDate, features, syncStatus } = useSettings()
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFAQr, setTwoFAQr] = useState<string>('')
  const [twoFAVisible, setTwoFAVisible] = useState(false)
  const [twoFACode, setTwoFACode] = useState('')
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState<boolean | null>(null)
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [passwordCode, setPasswordCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [requestingCode, setRequestingCode] = useState(false)
  const [confirmingChange, setConfirmingChange] = useState(false)
  const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'email'>('totp')

  useEffect(() => {
    if (user) {
      fetchProfile()
      setFormData({
        fullName: user.fullName,
        username: user.username,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      fetch2FAStatus()
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const edit = search.get('edit')
    const tf = search.get('twofa')
    if (edit === 'password') setIsChangingPassword(true)
    if (edit === 'profile') setIsEditingProfile(true)
    if (tf === 'setup') setTwoFAVisible(true)
  }, [user, search])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setProfileData(data.user)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const updateData: any = {
        fullName: formData.fullName,
        username: formData.username
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setIsEditingProfile(false)
        await fetchProfile()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword) {
      setMessage({ type: 'error', text: 'Enter current and new password' })
      return
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (isCurrentPasswordValid !== true) {
      setMessage({ type: 'error', text: 'Please verify your current password' })
      return
    }
    setRequestingCode(true)
    setMessage(null)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    try {
      if (!twoFAEnabled) {
        const response = await fetch('/api/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'change',
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
          }),
          signal: controller.signal
        })

        const data = await response.json()

        if (response.ok) {
          setMessage({ type: 'success', text: data.message || 'Password updated successfully' })
          setIsChangingPassword(false)
          setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }))
          setPasswordCode('')
          setCodeSent(false)
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to update password' })
        }
        return
      }
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'password_change_request',
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }),
        signal: controller.signal
      })

      const data = await response.json()

      if (response.ok) {
        setCodeSent(true)
        setMessage({ type: 'success', text: data.message || 'Verification code sent to your email' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' })
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Request timed out. Try again.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to send verification code' })
      }
    } finally {
      clearTimeout(timer)
      setRequestingCode(false)
    }
  }

  const handleConfirmPasswordChange = async () => {
    if (!codeSent) {
      setMessage({ type: 'error', text: 'Request a verification code first' })
      return
    }
    if (!passwordCode.trim()) {
      setMessage({ type: 'error', text: 'Enter the verification code' })
      return
    }
    setConfirmingChange(true)
    setMessage(null)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'password_change_confirm', code: passwordCode })
      })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Password updated successfully' })
        setIsChangingPassword(false)
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
        setPasswordCode('')
        setCodeSent(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update password' })
    } finally {
      setConfirmingChange(false)
    }
  }

  const verifyCurrentPassword = async () => {
    if (!formData.currentPassword) {
      setIsCurrentPasswordValid(null)
      return
    }
    try {
      setVerifyingPassword(true)
      setMessage(null)
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'verify', currentPassword: formData.currentPassword })
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setIsCurrentPasswordValid(true)
      } else {
        setIsCurrentPasswordValid(false)
        setMessage({ type: 'error', text: data.error || 'Current password is incorrect' })
      }
    } catch (e) {
      setIsCurrentPasswordValid(false)
      setMessage({ type: 'error', text: 'Failed to verify current password' })
    } finally {
      setVerifyingPassword(false)
    }
  }

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch('/api/user/2fa', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTwoFAEnabled(!!data.status?.enabled)
      }
    } catch {}
  }

  const handleToggle2FA = async (enabled: boolean) => {
    setMessage(null)
    if (enabled) {
      setTwoFAVisible(true)
      setModalMessage(null)
      if (twoFAMethod === 'totp') {
        try {
          const res = await fetch('/api/user/2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'init' })
          })
          const data = await res.json()
          if (res.ok) {
            setTwoFAQr(data.qr)
          } else {
            setModalMessage({ type: 'error', text: data.error || 'Failed to start 2FA setup' })
          }
        } catch {
          setModalMessage({ type: 'error', text: 'Failed to start 2FA setup' })
        }
      }
    } else {
      try {
        const res = await fetch('/api/user/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'disable' })
        })
        if (res.ok) {
          setTwoFAEnabled(false)
          setMessage({ type: 'success', text: 'Two-factor authentication disabled' })
        } else {
          const data = await res.json()
          setMessage({ type: 'error', text: data.error || 'Failed to disable 2FA' })
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to disable 2FA' })
      }
    }
  }

  const handleVerify2FA = async () => {
    setModalMessage(null)
    try {
      const res = await fetch('/api/user/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: twoFAMethod === 'totp' ? 'verify' : 'email-verify', code: twoFACode })
      })
      const data = await res.json()
      if (res.ok) {
        setTwoFAVisible(false)
        setTwoFACode('')
        setTwoFAEnabled(true)
        setMessage({ type: 'success', text: 'Two-factor authentication enabled' })
      } else {
        setModalMessage({ type: 'error', text: data.error || 'Invalid code' })
      }
    } catch {
      setModalMessage({ type: 'error', text: 'Failed to verify 2FA' })
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Please log in to view your profile.</p>
        </div>
      </div>
    )
  }

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
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>
        <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden">
          {/* Message Display */}
          {message && (
            <div className={`mx-8 mt-6 p-4 rounded-xl border ${
              message.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              {message.text}
            </div>
          )}

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="h-24 w-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-white/10">
                  <UserCircle className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="bg-transparent border-b-2 border-white/50 text-white placeholder-white/70 focus:outline-none focus:border-white transition-colors"
                        placeholder="Full Name"
                      />
                    ) : (
                      user.fullName
                    )}
                  </h1>
                  <p className="text-indigo-100 mt-1">
                    @{isEditingProfile ? (
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="bg-transparent border-b border-white/50 text-white placeholder-white/70 focus:outline-none focus:border-white transition-colors"
                        placeholder="username"
                      />
                    ) : (
                      user.username
                    )}
                  </p>
                  <p className="text-indigo-200">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isEditingProfile ? (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="flex items-center space-x-1 px-4 py-2 bg-white text-blue-600 rounded-xl hover:bg-indigo-50 disabled:opacity-50 font-medium transition-all shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      <span>{loading ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingProfile(false)
                        setMessage(null)
                        setFormData({
                          fullName: user.fullName,
                          username: user.username,
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        })
                      }}
                      className="flex items-center space-x-1 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 backdrop-blur-sm transition-all"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center space-x-1 px-4 py-2 bg-white/10 text-white border border-white/20 rounded-xl hover:bg-white/20 backdrop-blur-sm transition-all"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-blue-600">
                  {profileData?._count.feedbackGiven || 0}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Feedback Given</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-indigo-600">
                  {profileData?._count.feedbackReceived || 0}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Feedback Received</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center border border-slate-100 dark:border-slate-700">
                <div className="text-3xl font-bold text-indigo-600">
                  {profileData?._count.groupsCreated || 0}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">Groups Created</div>
              </div>
            </div>

            {/* Password Change Section */}
            {isChangingPassword && (
              <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-indigo-500" />
                  Change Password (Optional)
                </h2>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 space-y-4 border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => { setFormData({ ...formData, currentPassword: e.target.value }); setIsCurrentPasswordValid(null) }}
                      onBlur={verifyCurrentPassword}
                      className="w-full border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="Enter current password"
                    />
                    <div className="mt-2 text-sm">
                      {verifyingPassword ? (
                        <span className="text-slate-500">Verifying...</span>
                      ) : isCurrentPasswordValid === true ? (
                        <span className="text-emerald-600">Verified</span>
                      ) : isCurrentPasswordValid === false ? (
                        <span className="text-rose-600">Incorrect password</span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                    <input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      className="w-full border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="Confirm new password"
                    />
                  </div>
                  {!codeSent ? (
                    <div className="flex items-center space-x-2 pt-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={requestingCode || isCurrentPasswordValid !== true || !formData.newPassword || (formData.newPassword !== formData.confirmPassword)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {twoFAEnabled ? (requestingCode ? 'Sending...' : 'Send verification code') : (requestingCode ? 'Updating...' : 'Change password')}
                      </button>
                      <button
                        onClick={() => {
                          setIsChangingPassword(false)
                          setFormData(prev => ({
                            ...prev,
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          }))
                          setPasswordCode('')
                          setCodeSent(false)
                        }}
                        className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verification Code</label>
                        <input
                          type="text"
                          value={passwordCode}
                          onChange={(e) => setPasswordCode(e.target.value)}
                          className="w-full border-slate-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          placeholder="Enter the code sent to your email"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleConfirmPasswordChange}
                          disabled={confirmingChange || !passwordCode.trim()}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {confirmingChange ? 'Confirming...' : 'Confirm change'}
                        </button>
                        <button
                          onClick={() => {
                            setIsChangingPassword(false)
                            setFormData(prev => ({
                              ...prev,
                              currentPassword: '',
                              newPassword: '',
                              confirmPassword: ''
                            }))
                            setPasswordCode('')
                            setCodeSent(false)
                          }}
                          className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Information Sections */}
            <div className="space-y-6">
              {/* Account Information */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <UserCircle className="h-5 w-5 mr-2 text-indigo-500" />
                  Account Information
                </h2>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</div>
                    <div className="text-slate-900 dark:text-white">{user.fullName}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300">Username</div>
                    <div className="text-slate-900 dark:text-white">@{user.username}</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300">Email</div>
                    <div className="text-slate-900 dark:text-white flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                      {user.email}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300">Member Since</div>
                    <div className="text-slate-900 dark:text-white flex items-center" title={(profileData?.createdAt || (user as any)?.createdAt) ? new Date(profileData?.createdAt || (user as any)?.createdAt).toISOString() : ''}>
                      <Calendar className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                      {(() => {
                        const src = profileData?.createdAt || (user as any)?.createdAt
                        const d = src ? new Date(src) : new Date()
                        const now = Date.now()
                        if (isNaN(d.getTime()) || d.getTime() > now) {
                          return formatDate(new Date())
                        }
                        return formatDate(d)
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-indigo-500" />
                  Security
                </h2>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Password</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Secure your account with a strong password</div>
                    </div>
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="px-4 py-2 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      Change Password
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Two-Factor Authentication</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Add an extra layer of security</div>
                    </div>
                    <button
                      onClick={() => handleToggle2FA(!twoFAEnabled)}
                      disabled={features && features.twoFAAvailable === false}
                      className={`px-4 py-2 rounded-xl transition-colors ${
                        twoFAEnabled 
                          ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      } ${features && features.twoFAAvailable === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                    {features && features.twoFAAvailable === false && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 ml-3">2FA temporarily unavailable offline</div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Account Management */}
            <div className="mt-8">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-rose-900 mb-4">Account Management</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-rose-900 mb-2">Export Your Data</h4>
                    <p className="text-sm text-rose-700 dark:text-rose-400 mb-3">Download all your data from the platform</p>
                    <button
                      onClick={() => setMessage({ type: 'success', text: 'Data export coming soon!' })}
                      className="px-4 py-2 border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Export Data
                    </button>
                  </div>
                  <div>
                    <h4 className="font-medium text-rose-900 mb-2">Delete Account</h4>
                    <p className="text-sm text-rose-700 dark:text-rose-400 mb-3">Permanently delete your account and all associated data</p>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                          setMessage({ type: 'success', text: 'Account deletion feature coming soon!' })
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-sm transition-colors"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {twoFAVisible && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" aria-modal="true" role="dialog">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center mb-4">
                  <QrCode className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Set up Two-Factor Authentication</h3>
              </div>
              <div className="space-y-4">
                {modalMessage && (
                  <div className={`p-3 rounded-lg flex items-center border ${modalMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                    {modalMessage.type === 'success' ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    <span className="text-sm">{modalMessage.text}</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={async () => {
                        setTwoFAMethod('totp')
                        try {
                          const res = await fetch('/api/user/2fa', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ action: 'init' })
                          })
                          const data = await res.json()
                          if (res.ok) setTwoFAQr(data.qr)
                        } catch {}
                      }}
                      className={`px-3 py-1.5 rounded-lg border ${twoFAMethod === 'totp' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}
                    >
                      Authenticator App
                    </button>
                    <button
                      onClick={() => setTwoFAMethod('email')}
                      className={`px-3 py-1.5 rounded-lg border ${twoFAMethod === 'email' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}
                    >
                      Email Code
                    </button>
                  </div>
                  {twoFAMethod === 'totp' && (
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <img src={twoFAQr} alt="Authenticator QR code" className="mx-auto" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Enter 6-digit code</label>
                    <input
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      aria-label="Authenticator code"
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button 
                      onClick={() => setTwoFAVisible(false)} 
                      className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleVerify2FA} 
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
                    >
                      Verify & Enable
                    </button>
                  </div>
                  <div className="mt-2 text-center">
                    {twoFAMethod === 'email' && (
                      <button
                      onClick={async () => {
                        setModalMessage(null)
                        try {
                          await fetch('/api/user/2fa', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ action: 'email-init' })
                          })
                          setModalMessage({ type: 'success', text: 'Verification code sent to email' })
                        } catch {
                          setModalMessage({ type: 'error', text: 'Failed to send verification code' })
                        }
                      }}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors"
                    >
                      Send verification code to email
                    </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
