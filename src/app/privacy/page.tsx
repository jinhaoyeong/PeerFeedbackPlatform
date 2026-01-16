'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Lock, Eye, AlertCircle, Check, Download, ArrowLeft, CheckCircle, QrCode } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { useSettings } from '@/components/settings-provider'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Message = { type: 'success' | 'error', text: string }

type PrivacySettings = {
  allowAnonymousFeedback: boolean
  showInGroupDirectory: boolean
}

type OtherSettings = {
  loginAlertsEnabled: boolean
  profileVisibility: 'public' | 'group-members' | 'private'
  darkMode?: boolean
  language?: string
  timezone?: string
  allowMessaging?: boolean
}

export default function PrivacyPage() {
  const { user, token, twoFATempToken } = useAuth()
  const { language, timezone, saveSettings, features } = useSettings()
  const router = useRouter()
  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessions, setSessions] = useState<Array<{ id: string, action: string, occurredAt: string, details?: { email?: string } }>>([])
  const [privacy, setPrivacy] = useState<PrivacySettings>({ allowAnonymousFeedback: false, showInGroupDirectory: true })
  const [other, setOther] = useState<OtherSettings>({ loginAlertsEnabled: false, profileVisibility: 'group-members' })
  const [version, setVersion] = useState<number | null>(null)
  const [originalPrivacy, setOriginalPrivacy] = useState<PrivacySettings | null>(null)
  const [originalOther, setOriginalOther] = useState<OtherSettings | null>(null)
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFAQr, setTwoFAQr] = useState<string>('')
  const [twoFAVisible, setTwoFAVisible] = useState(false)
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFAMethod, setTwoFAMethod] = useState<'totp' | 'email'>('totp')
  const [modalMessage, setModalMessage] = useState<Message | null>(null)

  useEffect(() => {
    if (!user) return
    fetchSettings()
    fetch2FAStatus()
  }, [user])

  const fetchSettings = async () => {
    try {
      if (!token) return
      const res = await fetch('/api/user/settings', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      const s = data.settings || {}
      setVersion(Number(data.version || 1))
      const nextPrivacy = {
        allowAnonymousFeedback: !!s.allowAnonymousFeedback,
        showInGroupDirectory: !!s.showInGroupDirectory,
      }
      const nextOther = {
        loginAlertsEnabled: !!s.loginAlertsEnabled,
        profileVisibility: (s.profileVisibility || 'group-members') as OtherSettings['profileVisibility'],
        language,
        timezone,
        allowMessaging: typeof s.allowMessaging === 'undefined' ? true : !!s.allowMessaging,
      }
      setPrivacy(nextPrivacy)
      setOther(nextOther)
      setOriginalPrivacy(nextPrivacy)
      setOriginalOther(nextOther)
    } catch {}
  }

  const updateServerSettings = async (nextPrivacy: PrivacySettings, nextOther: OtherSettings) => {
    if (!token) {
      setMessage({ type: 'error', text: 'Please log in to save settings' })
      return false
    }
    setLoading(true)
    try {
      const currentDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          privacySettings: {
            allowAnonymousFeedback: nextPrivacy.allowAnonymousFeedback,
            showInGroupDirectory: nextPrivacy.showInGroupDirectory,
          },
          otherSettings: {
            loginAlertsEnabled: nextOther.loginAlertsEnabled,
            profileVisibility: nextOther.profileVisibility,
            darkMode: typeof nextOther.darkMode !== 'undefined' ? !!nextOther.darkMode : currentDark,
            language: nextOther.language,
            timezone: nextOther.timezone,
            allowMessaging: typeof nextOther.allowMessaging === 'undefined' ? undefined : !!nextOther.allowMessaging,
          },
          baseVersion: Number(version ?? 1),
        })
      })
      if (!res.ok) {
        let err: any = null
        try { err = await res.json() } catch {}
        setMessage({ type: 'error', text: err?.error || 'Failed to save settings' })
        return false
      }
      const data = await res.json()
      setVersion(Number(data.version || version || 1))
      setMessage({ type: 'success', text: 'Settings updated' })
      return true
    } catch {
      setMessage({ type: 'error', text: 'Could not update settings' })
      return false
    } finally {
      setLoading(false)
    }
  }

  const onPrivacyToggle = (key: keyof PrivacySettings, val: boolean) => {
    const next = { ...privacy, [key]: val }
    setPrivacy(next)
  }

  const onOtherToggle = (key: keyof OtherSettings, val: boolean | OtherSettings['profileVisibility']) => {
    const next = { ...other, [key]: val } as OtherSettings
    setOther(next)
  }

  const fetch2FAStatus = async () => {
    try {
      if (!token) return
      const res = await fetch('/api/user/2fa', { headers: { Authorization: `Bearer ${token}` } })
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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const saveAll = async () => {
    const ok = await updateServerSettings(privacy, other)
    if (ok) {
      setOriginalPrivacy(privacy)
      setOriginalOther(other)
    }
  }

  const isDirty = useMemo(() => {
    const a = originalPrivacy ? JSON.stringify(originalPrivacy) : ''
    const b = originalOther ? JSON.stringify(originalOther) : ''
    return JSON.stringify(privacy) !== a || JSON.stringify(other) !== b
  }, [privacy, other, originalPrivacy, originalOther])

  const handleViewSessions = async () => {
    setSessionsOpen(true)
    setSessionsLoading(true)
    try {
      if (!token) { setSessionsLoading(false); return }
      const res = await fetch('/api/user/sessions', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load sessions')
      const data = await res.json()
      setSessions((data.events ?? []).map((e: any) => ({ id: e.id, action: e.action, occurredAt: e.occurredAt, details: e.details })))
    } catch (e) {
      console.error(e)
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleExportData = async () => {
    setLoading(true)
    setMessage(null)
    try {
      if (!token) { setMessage({ type: 'error', text: 'Please log in to export data' }); return }
      const res = await fetch('/api/user/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      const url = data?.jsonUrl || data?.csvUrl
      if (url) {
        window.open(String(url), '_blank')
        setMessage({ type: 'success', text: 'Export started' })
      } else {
        setMessage({ type: 'success', text: 'Export queued' })
      }
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: 'Could not export data' })
    } finally {
      setLoading(false)
    }
  }

  const knob = useMemo(() => (
    <span className="block h-5 w-5 rounded-full bg-white shadow transition-transform" />
  ), [])

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Please log in to view privacy information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
              } else {
                router.push('/dashboard')
              }
            }}
            className="inline-flex items-center space-x-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-2xl">
              <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy & Security</h1>
          </div>
          {isDirty && (
            <button
              onClick={saveAll}
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 transition-all disabled:opacity-50 font-medium flex items-center"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-8 p-4 rounded-xl flex items-center border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
            {message.text}
          </div>
        )}

        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                <Lock className="h-5 w-5 mr-3 text-indigo-600 dark:text-indigo-400" />
                Security Settings
              </h2>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">Password</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Use a strong, unique password.</p>
                <button className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 text-indigo-600 border border-indigo-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 font-medium" onClick={() => router.push('/profile?edit=password')}>Change Password</button>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">Two-Factor Authentication</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Add an extra layer of security.</p>
                <button
                  onClick={() => handleToggle2FA(!twoFAEnabled)}
                  disabled={features && features.twoFAAvailable === false}
                  className={`w-full px-4 py-2.5 rounded-xl font-medium transition-colors ${
                    twoFAEnabled
                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } ${features && features.twoFAAvailable === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
                {features && features.twoFAAvailable === false && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">2FA temporarily unavailable offline</div>
                )}
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">Active Sessions</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Manage logged-in devices and activity.</p>
                <button className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-medium" onClick={handleViewSessions}>View Sessions</button>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Login Alerts</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Email alerts for new logins (requires Settings → Email Notifications ON)</p>
                  </div>
                  <SwitchPrimitive.Root disabled={loading} className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative data-[state=checked]:bg-indigo-600" checked={other.loginAlertsEnabled} onCheckedChange={(c) => onOtherToggle('loginAlertsEnabled', c)}>
                    <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0 data-[state=checked]:translate-x-5" />
                  </SwitchPrimitive.Root>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                <Eye className="h-5 w-5 mr-3 text-indigo-600 dark:text-indigo-400" />
                Privacy Controls
              </h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Profile Visibility</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Control who can see your profile information</p>
                </div>
                <Select
                  disabled={loading}
                  value={other.profileVisibility}
                  onValueChange={(value) => onOtherToggle('profileVisibility', value as OtherSettings['profileVisibility'])}
                >
                  <SelectTrigger className="w-[200px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="group-members">Group Members Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Allow Messaging</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Let other members send you direct messages</p>
                </div>
                <SwitchPrimitive.Root disabled={loading} className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative data-[state=checked]:bg-indigo-600" checked={!!other.allowMessaging} onCheckedChange={(c) => onOtherToggle('allowMessaging', c)}>
                  <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0 data-[state=checked]:translate-x-5" />
                </SwitchPrimitive.Root>
              </div>
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Feedback Anonymity</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Default to anonymous feedback when possible</p>
                </div>
                <SwitchPrimitive.Root disabled={loading} className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative data-[state=checked]:bg-indigo-600" checked={privacy.allowAnonymousFeedback} onCheckedChange={(c) => onPrivacyToggle('allowAnonymousFeedback', c)}>
                  <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0 data-[state=checked]:translate-x-5" />
                </SwitchPrimitive.Root>
              </div>
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Show In Group Directory</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Appear in member listings</p>
                </div>
                <SwitchPrimitive.Root disabled={loading} className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative data-[state=checked]:bg-indigo-600" checked={privacy.showInGroupDirectory} onCheckedChange={(c) => onPrivacyToggle('showInGroupDirectory', c)}>
                  <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0 data-[state=checked]:translate-x-5" />
                </SwitchPrimitive.Root>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Data Management</h2>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Export Your Data</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Download a copy of all your data</p>
                </div>
                <button onClick={handleExportData} disabled={loading} className="flex items-center space-x-2 px-4 py-2.5 text-indigo-600 border border-indigo-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800">
                  <Download className="h-4 w-4" />
                  <span>{loading ? 'Exporting...' : 'Export Data'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>



        {twoFAVisible && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" aria-modal="true" role="dialog">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
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
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
                  <div className="p-4 bg-white dark:bg-white rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[160px] flex items-center justify-center">
                    {twoFAQr ? (
                      <img src={twoFAQr} alt="Authenticator QR code" className="mx-auto" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-500">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                        <span className="text-sm">Loading QR...</span>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Enter 6-digit code</label>
                  <input
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
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
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 transition-colors"
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
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        {sessionsOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" aria-modal="true" role="dialog">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Active Sessions</h3>
                <button onClick={() => setSessionsOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">Close</button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {sessionsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-slate-500 dark:text-slate-400">Loading sessions...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 border-dashed">
                    <p className="text-slate-500 dark:text-slate-400">No recent sessions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div>
                          <div className="text-base font-semibold text-slate-900 dark:text-white flex items-center">
                            <span className={`w-2 h-2 rounded-full mr-2 ${s.action === 'USER_LOGIN' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {s.action === 'USER_LOGIN' ? 'Login' : 'Logout'}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-4">{new Date(s.occurredAt).toLocaleString()}</div>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                          {s.details?.email || 'Unknown'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
