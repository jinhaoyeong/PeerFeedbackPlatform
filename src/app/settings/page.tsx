'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useSettings } from '@/components/settings-provider'
import { Settings, Bell, Moon, Sun, Globe, Check, AlertCircle, Download, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

interface UserSettings {
  emailNotifications: boolean
  darkMode: boolean
  language: string
  timezone: string
  allowAnonymousFeedback: boolean
  showInGroupDirectory: boolean
  allowMessaging: boolean
  pushNotifications?: boolean
}

export default function SettingsPage() {
  const { user, token } = useAuth()
  const { setPreferences, saveSettings, syncStatus, lastSyncError } = useSettings()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [exportInProgress, setExportInProgress] = useState(false)
  const [exportLinks, setExportLinks] = useState<{ jsonUrl?: string; csvUrl?: string }>({})
  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    darkMode: false,
    language: 'en',
    timezone: 'UTC',
    allowAnonymousFeedback: true,
    showInGroupDirectory: true,
    allowMessaging: true,
    pushNotifications: false
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [originalSettings, setOriginalSettings] = useState<UserSettings | null>(null)
  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings)
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)

  useEffect(() => {
    if (user && token) {
      fetchSettings()
    } else {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
        if (raw) {
          const parsed = JSON.parse(raw)
          const s = {
            emailNotifications: !!parsed.emailNotifications,
            darkMode: !!parsed.darkMode,
            language: String(parsed.language || 'en'),
            timezone: String(parsed.timezone || 'UTC'),
            allowAnonymousFeedback: !!parsed.allowAnonymousFeedback,
            showInGroupDirectory: !!parsed.showInGroupDirectory,
            allowMessaging: typeof parsed.allowMessaging === 'undefined' ? true : !!parsed.allowMessaging,
            pushNotifications: !!parsed.pushNotifications
          }
          setSettings(s)
          setOriginalSettings(s)
        }
      } catch {}
    }
  }, [user, token])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        setOriginalSettings(data.settings)
      } else {
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
          if (raw) {
            const parsed = JSON.parse(raw)
            const s = {
              emailNotifications: !!parsed.emailNotifications,
              darkMode: !!parsed.darkMode,
              language: String(parsed.language || 'en'),
              timezone: String(parsed.timezone || 'UTC'),
              allowAnonymousFeedback: !!parsed.allowAnonymousFeedback,
              showInGroupDirectory: !!parsed.showInGroupDirectory,
              allowMessaging: typeof parsed.allowMessaging === 'undefined' ? true : !!parsed.allowMessaging,
              pushNotifications: !!parsed.pushNotifications
            }
            setSettings(s)
            setOriginalSettings(s)
          }
        } catch {}
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
        if (raw) {
          const parsed = JSON.parse(raw)
          const s = {
            emailNotifications: !!parsed.emailNotifications,
            darkMode: !!parsed.darkMode,
            language: String(parsed.language || 'en'),
            timezone: String(parsed.timezone || 'UTC'),
            allowAnonymousFeedback: !!parsed.allowAnonymousFeedback,
            showInGroupDirectory: !!parsed.showInGroupDirectory,
            allowMessaging: typeof parsed.allowMessaging === 'undefined' ? true : !!parsed.allowMessaging,
            pushNotifications: !!parsed.pushNotifications
          }
          setSettings(s)
          setOriginalSettings(s)
        }
      } catch {}
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveSettings(settings)
      setPreferences({ language: settings.language, timezone: settings.timezone })
      setOriginalSettings(settings)
      setMessage({ type: 'success', text: syncStatus === 'offline' ? 'Saved locally. Will sync when online.' : 'Settings updated successfully' })
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: error?.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  

  

  

  const handleExportData = async () => {
    if (!confirm('Prepare a data export? You will receive a notification when ready.')) {
      return
    }
    setExportInProgress(true)
    setMessage(null)
    try {
      const res = await fetch('/api/user/export', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setExportLinks({ jsonUrl: data.jsonUrl, csvUrl: data.csvUrl })
        setMessage({ type: 'success', text: 'Export ready. Download below or check notifications.' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start export' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to start export' })
    } finally {
      setExportInProgress(false)
    }
  }

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p>Please log in to view settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => {
              if (isDirty) {
                setShowUnsavedConfirm(true)
                return
              }
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
              } else {
                router.push('/dashboard')
              }
            }}
            className="inline-flex items-center space-x-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
                <Settings className="h-8 w-8 mr-3 text-blue-600 dark:text-indigo-400" />
                Settings
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">Manage your account settings and preferences</p>
            </div>
            {isDirty && (
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 transition-all disabled:opacity-50 font-medium flex items-center"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center border ${
            message.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' 
              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-400 border-rose-100 dark:border-rose-800'
          }`}>
            {message.type === 'success' ? (
              <Check className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Sync Indicator */}
        {syncStatus !== 'idle' && (
          <div className={`mb-4 p-3 rounded-xl text-sm border ${
            syncStatus === 'syncing' 
              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800' 
              : syncStatus === 'offline' 
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 border-amber-100 dark:border-amber-800' 
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-400 border-rose-100 dark:border-rose-800'
          }`}>
            {syncStatus === 'syncing' && 'Synchronizing settings…'}
            {syncStatus === 'offline' && 'Offline: changes queued and will sync when online.'}
            {syncStatus === 'error' && `Sync error: ${lastSyncError || 'Unknown error'}`}
          </div>
        )}

        <div className="space-y-6">
          {/* Notifications */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Bell className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                Notifications
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Email Notifications</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Receive email for system and session updates. Login alerts are controlled in Privacy & Security.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Push Notifications</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Receive browser push notifications</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.pushNotifications}
                    onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                {settings.darkMode ? <Moon className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" /> : <Sun className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />}
                Appearance
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">Dark Mode</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Toggle dark/light theme</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.darkMode}
                    onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 dark:peer-focus:ring-indigo-900/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          

          {/* Data Export */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Download className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                Data Export
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">Export your profile, activity, and preferences as JSON or CSV.</p>
              <button
                onClick={handleExportData}
                disabled={exportInProgress}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20"
                aria-busy={exportInProgress}
              >
                {exportInProgress ? 'Preparing Export...' : 'Export Data'}
              </button>
              {exportLinks.jsonUrl && (
                <div className="flex items-center space-x-4" role="group" aria-label="Download export">
                  <a href={exportLinks.jsonUrl} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium">Download JSON</a>
                  <a href={exportLinks.csvUrl} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium">Download CSV</a>
                </div>
              )}
            </div>
          </div>

          {/* Regional */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Globe className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                Regional Settings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => handleSettingChange('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog open={showUnsavedConfirm} onOpenChange={setShowUnsavedConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Exit without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowUnsavedConfirm(false)
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back()
                  } else {
                    router.push('/dashboard')
                  }
                }}
              >
                Discard Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
