'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  username: string
  fullName: string
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string
  privacySettings?: {
    allowAnonymousFeedback: boolean
    receiveEmailNotifications: boolean
    showInGroupDirectory: boolean
  }
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  verifyTwoFA: (code: string) => Promise<void>
  sendTwoFAFallback: () => Promise<void>
  register: (userData: {
    email: string
    username: string
    password: string
    fullName: string
  }) => Promise<void>
  logout: () => void
  loading: boolean
  isAuthenticated: boolean
  twoFATempToken?: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [twoFATempToken, setTwoFATempToken] = useState<string | null>(null)
  const router = useRouter()

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedToken = localStorage.getItem('auth-token')
        const storedUser = localStorage.getItem('auth-user')

        if (storedToken && storedUser) {
          // Basic token validation (you could add more sophisticated checks)
          try {
            const tokenData = JSON.parse(atob(storedToken.split('.')[1]))
            const now = Date.now() / 1000

            if (tokenData.exp > now) {
              setToken(storedToken)
              setUser(JSON.parse(storedUser))
            } else {
              // Token expired
              localStorage.removeItem('auth-token')
              localStorage.removeItem('auth-user')
            }
          } catch (error) {
            console.error('Invalid token format:', error)
            localStorage.removeItem('auth-token')
            localStorage.removeItem('auth-user')
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      if (data.requires2FA) {
        setTwoFATempToken(data.tempToken)
        setLoading(false)
        return
      }

      const { user: userData, token: newToken } = data

      // Store in state
      setUser(userData)
      setToken(newToken)

      // Store in localStorage
      localStorage.setItem('auth-token', newToken)
      localStorage.setItem('auth-user', JSON.stringify(userData))

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const verifyTwoFA = async (code: string): Promise<void> => {
    if (!twoFATempToken) throw new Error('No pending 2FA')
    setLoading(true)
    try {
      let response = await fetch('/api/user/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${twoFATempToken}` },
        body: JSON.stringify({ action: 'login-verify', code })
      })
      let data = await response.json()
      if (!response.ok) {
        response = await fetch('/api/user/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${twoFATempToken}` },
          body: JSON.stringify({ action: 'verify-fallback', code })
        })
        data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Invalid code')
        }
      }
      const { user: userData, token: newToken } = data
      setUser(userData)
      setToken(newToken)
      localStorage.setItem('auth-token', newToken)
      localStorage.setItem('auth-user', JSON.stringify(userData))
      setTwoFATempToken(null)
      router.push('/dashboard')
    } catch (error) {
      console.error('2FA verify error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const sendTwoFAFallback = async (): Promise<void> => {
    if (!twoFATempToken) throw new Error('No pending 2FA')
    try {
      await fetch('/api/user/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${twoFATempToken}` },
        body: JSON.stringify({ action: 'fallback', method: 'email' })
      })
    } catch {}
  }

  const register = async (userData: {
    email: string
    username: string
    password: string
    fullName: string
  }): Promise<void> => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        const errors = Array.isArray(data?.errors)
          ? data.errors.filter(Boolean).join('; ')
          : (typeof data?.errors === 'string' ? data.errors : '')
        const candidates = [
          typeof data?.message === 'string' ? data.message : '',
          errors,
          typeof data?.detail === 'string' ? data.detail : '',
          typeof data?.error === 'string' ? data.error : ''
        ].filter(Boolean)
        const msg = candidates.length > 0
          ? candidates[0] + (candidates.slice(1).filter(Boolean).length ? `: ${candidates.slice(1).join('; ')}` : '')
          : 'Registration failed'
        throw new Error(msg)
      }

      const { user: newUser, token: newToken } = data

      // Store in state
      setUser(newUser)
      setToken(newToken)

      // Store in localStorage
      localStorage.setItem('auth-token', newToken)
      localStorage.setItem('auth-user', JSON.stringify(newUser))

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = (): void => {
    // Clear state
    setUser(null)
    setToken(null)

    // Clear localStorage
    localStorage.removeItem('auth-token')
    localStorage.removeItem('auth-user')
    try { localStorage.removeItem('user-settings') } catch {}
    try { localStorage.removeItem('settings-pending-ops') } catch {}

    // Redirect to home
    router.push('/')
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    verifyTwoFA,
    sendTwoFAFallback,
    register,
    logout,
    loading,
    isAuthenticated: !!user && !!token,
    twoFATempToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
