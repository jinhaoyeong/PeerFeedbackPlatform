'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useAuth } from './auth-provider'
import { useSocket } from './socket-provider'

type SettingsContextValue = {
  language: string
  timezone: string
  version: number
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  lastSyncError: string | null
  features: { twoFAAvailable?: boolean }
  setPreferences: (prefs: { language?: string; timezone?: string }) => void
  saveSettings: (settings: {
    emailNotifications?: boolean
    darkMode?: boolean
    language?: string
    timezone?: string
    allowAnonymousFeedback?: boolean
    showInGroupDirectory?: boolean
    pushNotifications?: boolean
  }) => Promise<void>
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const { socket } = useSocket()
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [version, setVersion] = useState(1)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle')
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [features, setFeatures] = useState<{ twoFAAvailable?: boolean }>({})

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
      if (raw) {
        const parsed = JSON.parse(raw)
        const migrated = migrateSettings(parsed)
        if (migrated.language) setLanguage(String(migrated.language))
        if (migrated.timezone) setTimezone(String(migrated.timezone))
        if (parsed.version) setVersion(Number(parsed.version) || 1)
        try {
          const root = document.documentElement
          if (migrated.darkMode) root.classList.add('dark')
          else root.classList.remove('dark')
        } catch {}
        try { localStorage.setItem('user-settings', JSON.stringify(migrated)) } catch {}
      }
    } catch {}
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'user-settings' || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        if (parsed.language) setLanguage(String(parsed.language))
        if (parsed.timezone) setTimezone(String(parsed.timezone))
        if (parsed.version) setVersion(Number(parsed.version) || 1)
        try {
          const root = document.documentElement
          if (parsed.darkMode) root.classList.add('dark')
          else root.classList.remove('dark')
        } catch {}
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language || 'en'
    }
  }, [language])

  useEffect(() => {
    const updateStatus = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline')
        setFeatures(f => ({ ...f, twoFAAvailable: false }))
      } else if (syncStatus === 'offline') {
        setSyncStatus('idle')
        setFeatures(f => ({ ...f, twoFAAvailable: true }))
        processPendingQueue()
      }
    }
    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [syncStatus])

  useEffect(() => {
    const fetchFeatures = async () => {
      if (!token) return
      try {
        const res = await fetch('/api/user/2fa', { headers: { 'Authorization': `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          setFeatures({ twoFAAvailable: !!data.status || !!data.secret || !!data.enabled })
        }
      } catch {}
    }
    fetchFeatures()
  }, [token])

  useEffect(() => {
    const loadFromServer = async () => {
      if (!token) return
      try {
        const res = await fetch('/api/user/settings', { headers: { 'Authorization': `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          const s = migrateSettings(data.settings || {})
          const v = Number(data.version || 1)
          setVersion(v)
          if (s.language) setLanguage(String(s.language))
          if (s.timezone) setTimezone(String(s.timezone))
          try {
            const root = document.documentElement
            if (s.darkMode) root.classList.add('dark')
            else root.classList.remove('dark')
          } catch {}
          try {
            const current = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
            const base = current ? JSON.parse(current) : {}
            const merged = migrateSettings({ ...base, ...s, version: v })
            localStorage.setItem('user-settings', JSON.stringify(merged))
          } catch {}
        }
      } catch {}
    }
    loadFromServer()
  }, [token])

  useEffect(() => {
    if (!socket) return
    const handler = (payload: any) => {
      try {
        const s = migrateSettings(payload?.settings || {})
        const v = Number(payload?.version) || version
        if (s.language) setLanguage(String(s.language))
        if (s.timezone) setTimezone(String(s.timezone))
        setVersion(v)
        try {
          const root = document.documentElement
          if (s.darkMode) root.classList.add('dark')
          else root.classList.remove('dark')
        } catch {}
        try {
          const current = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
          const base = current ? JSON.parse(current) : {}
          const merged = migrateSettings({ ...base, ...s, version: v })
          localStorage.setItem('user-settings', JSON.stringify(merged))
        } catch {}
      } catch {}
    }
    socket.on('settings_changed', handler)
    return () => {
      socket.off('settings_changed', handler)
    }
  }, [socket, version])

  const migrateSettings = (settings: any) => {
    const cloned = { ...settings }
    if (typeof cloned.emailNotifications === 'undefined') cloned.emailNotifications = true
    if (typeof cloned.darkMode === 'undefined') cloned.darkMode = false
    if (typeof cloned.language === 'undefined') cloned.language = 'en'
    if (typeof cloned.timezone === 'undefined') cloned.timezone = 'UTC'
    if (typeof cloned.allowAnonymousFeedback === 'undefined') cloned.allowAnonymousFeedback = true
    if (typeof cloned.showInGroupDirectory === 'undefined') cloned.showInGroupDirectory = true
    if (typeof cloned.pushNotifications === 'undefined') cloned.pushNotifications = false
    if (typeof cloned.allowMessaging === 'undefined') cloned.allowMessaging = true
    return cloned
  }

  const setPreferences = (prefs: { language?: string; timezone?: string }) => {
    if (prefs.language) setLanguage(String(prefs.language))
    if (prefs.timezone) setTimezone(String(prefs.timezone))
    try {
      const current = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
      const base = current ? JSON.parse(current) : {}
      const merged = migrateSettings({ ...base, language: prefs.language ?? language, timezone: prefs.timezone ?? timezone, version })
      localStorage.setItem('user-settings', JSON.stringify(merged))
    } catch {}
  }

  const enqueuePending = (payload: any) => {
    try {
      const raw = localStorage.getItem('settings-pending-ops')
      const list = raw ? JSON.parse(raw) : []
      list.push({ ts: Date.now(), baseVersion: version, payload })
      localStorage.setItem('settings-pending-ops', JSON.stringify(list))
    } catch {}
  }

  const processPendingQueue = async () => {
    try {
      const raw = localStorage.getItem('settings-pending-ops')
      const list: any[] = raw ? JSON.parse(raw) : []
      if (!list.length || !token) return
      for (const item of list) {
        await sendToServer(migrateSettings(item.payload), item.baseVersion)
      }
      localStorage.removeItem('settings-pending-ops')
    } catch {}
  }

  const validateConsistency = async () => {
    try {
      const res = await fetch('/api/user/settings', { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        const s = migrateSettings(data.settings || {})
        const localRaw = typeof window !== 'undefined' ? localStorage.getItem('user-settings') : null
        const local = migrateSettings(localRaw ? JSON.parse(localRaw) : {})
        const keys = ['language','timezone','emailNotifications','darkMode','allowAnonymousFeedback','showInGroupDirectory','pushNotifications','allowMessaging']
        for (const k of keys) {
          if (typeof s[k] !== 'undefined' && s[k] !== local[k]) {
            throw new Error(`Consistency mismatch on ${k}`)
          }
        }
      }
    } catch (e: any) {
      setLastSyncError(e?.message || 'Consistency validation failed')
      setSyncStatus('error')
    }
  }

  const sendToServer = async (settings: any, baseVersion?: number) => {
    if (!token || !user) return
    setSyncStatus('syncing')
    setLastSyncError(null)
    try {
      // Get current dark mode state if not provided in update
      let currentDarkMode = false
      try {
        if (typeof document !== 'undefined') {
          currentDarkMode = document.documentElement.classList.contains('dark')
        }
      } catch {}

      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          privacySettings: {
            receiveEmailNotifications: !!settings.emailNotifications,
            allowAnonymousFeedback: !!settings.allowAnonymousFeedback,
            showInGroupDirectory: !!settings.showInGroupDirectory,
          },
          otherSettings: {
            darkMode: typeof settings.darkMode !== 'undefined' ? !!settings.darkMode : currentDarkMode,
            language: String(settings.language || language),
            timezone: String(settings.timezone || timezone),
            allowMessaging: typeof settings.allowMessaging === 'undefined' ? undefined : !!settings.allowMessaging,
          },
          pushNotifications: !!settings.pushNotifications,
          baseVersion: baseVersion ?? version
        })
      })
      const data = await response.json()
      if (response.status === 409 && data?.conflict) {
        const latest = migrateSettings(data.latestSettings || {})
        const merged = migrateSettings({ ...latest, ...settings })
        const rebasedVersion = Number(data.latestVersion || version)
        await sendToServer(merged, rebasedVersion)
        return
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings')
      }
      const newVersion = Number(data.version || (version + 1))
      setVersion(newVersion)
      try {
        const current = localStorage.getItem('user-settings')
        const base = current ? JSON.parse(current) : {}
        const merged = migrateSettings({ ...base, ...settings, version: newVersion })
        localStorage.setItem('user-settings', JSON.stringify(merged))
      } catch {}
      try {
        const root = document.documentElement
        if (settings.darkMode) root.classList.add('dark')
        else root.classList.remove('dark')
      } catch {}
      if (socket && user?.id) {
        socket.emit('settings_updated', { userId: user.id, settings, version: newVersion })
      }
      setSyncStatus('idle')
      await validateConsistency()
    } catch (error: any) {
      setLastSyncError(error?.message || 'Settings sync failed')
      enqueuePending(settings)
      setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    }
  }

  const saveSettings = async (settings: any) => {
    // optimistic update
    if (settings.language) setLanguage(String(settings.language))
    if (settings.timezone) setTimezone(String(settings.timezone))
    try {
      const current = localStorage.getItem('user-settings')
      const base = current ? JSON.parse(current) : {}
      const optimistic = { ...settings }
      if (typeof optimistic.darkMode !== 'undefined') delete optimistic.darkMode
      const merged = migrateSettings({ ...base, ...optimistic, version })
      localStorage.setItem('user-settings', JSON.stringify(merged))
    } catch {}

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueuePending(settings)
      setSyncStatus('offline')
      return
    }
    await sendToServer(settings)
  }

  const formatter = (options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language || undefined, { timeZone: timezone, ...options })

  const formatDate = (value: string | Date, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof value === 'string' ? new Date(value) : value
    if (isNaN(d.getTime())) return ''
    return formatter({ year: 'numeric', month: 'long', day: 'numeric', ...(options || {}) }).format(d)
  }

  const formatDateTime = (value: string | Date, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof value === 'string' ? new Date(value) : value
    if (isNaN(d.getTime())) return ''
    return formatter({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...(options || {}) }).format(d)
  }

  const value = useMemo<SettingsContextValue>(() => ({
    language,
    timezone,
    version,
    syncStatus,
    lastSyncError,
    features,
    setPreferences,
    saveSettings,
    formatDate,
    formatDateTime
  }), [language, timezone, version, syncStatus, lastSyncError, features])

  return (
    <SettingsContext.Provider value={value}>
      {children}
      {syncStatus !== 'idle' && (
        <div className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-md shadow ${
          syncStatus === 'syncing' ? 'bg-blue-600 text-white' : syncStatus === 'offline' ? 'bg-yellow-500 text-black' : 'bg-red-600 text-white'
        }`} aria-live="polite">
          {syncStatus === 'syncing' && 'Syncing settings…'}
          {syncStatus === 'offline' && 'Offline: queued changes'}
          {syncStatus === 'error' && `Sync error: ${lastSyncError || 'Unknown'}`}
        </div>
      )}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
