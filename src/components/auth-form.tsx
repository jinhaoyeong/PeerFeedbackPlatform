'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Shield } from 'lucide-react'

interface AuthFormData {
  email: string
  password: string
  confirmPassword?: string
  username?: string
  fullName?: string
}

interface AuthFormProps {
  mode: 'login' | 'register'
  onModeChange: (mode: 'login' | 'register') => void
}

export function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const { login, register, loading, twoFATempToken, verifyTwoFA, sendTwoFAFallback } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    fullName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [twoFACode, setTwoFACode] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotCodeSent, setForgotCodeSent] = useState(false)
  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and numbers'
    }

    // Additional validations for register mode
    if (mode === 'register') {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = 'Passwords do not match'
      }

      if (!formData.username) {
        newErrors.username = 'Username is required'
      } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
        newErrors.username = 'Username must be 3-20 characters, alphanumeric and underscores only'
      }

      if (!formData.fullName) {
        newErrors.fullName = 'Full name is required'
      } else if (formData.fullName.trim().length < 2) {
        newErrors.fullName = 'Full name must be at least 2 characters long'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (twoFATempToken && mode === 'login') {
      setIsSubmitting(true)
      try {
        await verifyTwoFA(twoFACode.trim())
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid code'
        setErrors({ submit: errorMessage })
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password)
      } else {
        await register({
          email: formData.email,
          password: formData.password,
          username: formData.username!,
          fullName: formData.fullName!,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMode = () => {
    setErrors({})
    setFormData({ email: '', password: '', confirmPassword: '', username: '', fullName: '' })
    setForgotOpen(false)
    setForgotCodeSent(false)
    setForgotCode('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotMessage(null)
    onModeChange(mode === 'login' ? 'register' : 'login')
  }

  const handleSendResetCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email || !emailRegex.test(formData.email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }))
      return
    }
    setForgotSubmitting(true)
    setForgotMessage(null)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: formData.email })
      })
      const data = await response.json()
      if (response.ok) {
        setForgotCodeSent(true)
        setForgotMessage(data.message || 'Verification code sent to your email')
      } else {
        setForgotMessage(data.message || 'Failed to send verification code')
      }
    } catch (e) {
      setForgotMessage('Failed to send verification code')
    } finally {
      setForgotSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!forgotCode.trim()) {
      setForgotMessage('Enter the verification code')
      return
    }
    if (!forgotNewPassword) {
      setForgotMessage('Enter a new password')
      return
    }
    if (forgotNewPassword.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(forgotNewPassword)) {
      setForgotMessage('Password must contain uppercase, lowercase, and numbers')
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotMessage('New passwords do not match')
      return
    }
    setForgotSubmitting(true)
    setForgotMessage(null)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', email: formData.email, code: forgotCode.trim(), newPassword: forgotNewPassword })
      })
      const data = await response.json()
      if (response.ok) {
        setForgotMessage(data.message || 'Password updated successfully')
        setForgotOpen(false)
        setForgotCodeSent(false)
        setForgotCode('')
        setForgotNewPassword('')
        setForgotConfirmPassword('')
      } else {
        setForgotMessage(data.message || 'Failed to reset password')
      }
    } catch (e) {
      setForgotMessage('Failed to reset password')
    } finally {
      setForgotSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {mode === 'login'
            ? 'Sign in to your Peer Feedback account'
            : 'Join our community of constructive feedback'
          }
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {twoFATempToken && mode === 'login' ? (
          <>
            <div>
              <label htmlFor="twofa" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verification Code</label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="twofa"
                  name="twofa"
                  type="text"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                    errors.submit ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                  placeholder="6-digit code"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Verify
              </button>
              <button
                type="button"
                onClick={sendTwoFAFallback}
                className="text-sm text-blue-600 dark:text-indigo-400 hover:text-blue-700 dark:hover:text-indigo-300 hover:underline"
              >
                Send fallback code to email
              </button>
            </div>

            {errors.submit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errors.submit}
                </p>
              </div>
            )}
          </>
        ) : (
        <>
        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                    errors.fullName ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                  placeholder="John Doe"
                  disabled={isSubmitting}
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.fullName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                    errors.username ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                  placeholder="johndoe"
                  disabled={isSubmitting}
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.username}
                </p>
              )}
            </div>
          </>
        )}

        {/* Email field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                errors.email ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-10 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                errors.password ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
              placeholder="••••••••"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.password}
            </p>
          )}
          {mode === 'register' && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Must contain uppercase, lowercase, and numbers
            </p>
          )}
        </div>

        {/* Confirm Password field - only in register mode */}
        {mode === 'register' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-10 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                  errors.confirmPassword ? 'border-red-300 dark:border-red-800' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
                placeholder="••••••••"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                disabled={isSubmitting}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.confirmPassword}
              </p>
            )}
          </div>
        )}

        {/* Submit error */}
        {errors.submit && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              {errors.submit}
            </p>
          </div>
        )}

        {/* Submit button */}
        {!twoFATempToken && (
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        )}

        {/* Mode toggle */}
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          {mode === 'login' && !twoFATempToken && (
            <p className="mt-2 text-sm">
              <button
                type="button"
                onClick={() => setForgotOpen(!forgotOpen)}
                className="text-blue-600 dark:text-indigo-400 hover:text-blue-700 dark:hover:text-indigo-300 hover:underline"
              >
                {forgotOpen ? 'Close forgot password' : 'Forgot password?'}
              </button>
            </p>
          )}
        </div>

        {mode === 'login' && forgotOpen && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="forgot-email"
                  name="forgot-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                  placeholder="you@example.com"
                  disabled={forgotSubmitting}
                />
              </div>
            </div>

            <div className="mt-3">
              {!forgotCodeSent ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={forgotSubmitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {forgotSubmitting ? 'Sending...' : 'Send reset code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="forgot-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verification Code</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                      <input
                        id="forgot-code"
                        name="forgot-code"
                        type="text"
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                        placeholder="6-digit code"
                        disabled={forgotSubmitting}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="forgot-new" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                      <input
                        id="forgot-new"
                        name="forgot-new"
                        type="password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                        placeholder="••••••••"
                        disabled={forgotSubmitting}
                      />
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Must contain uppercase, lowercase, and numbers</p>
                  </div>
                  <div>
                    <label htmlFor="forgot-confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                      <input
                        id="forgot-confirm"
                        name="forgot-confirm"
                        type="password"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
                        placeholder="••••••••"
                        disabled={forgotSubmitting}
                      />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={forgotSubmitting}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {forgotSubmitting ? 'Resetting...' : 'Reset password'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {forgotMessage && (
              <div className="mt-3 bg-blue-50 dark:bg-indigo-900/20 border border-blue-100 dark:border-indigo-800 rounded-xl p-3">
                <p className="text-sm text-blue-900 dark:text-indigo-300 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {forgotMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Privacy notice */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-indigo-900/20 border border-blue-100 dark:border-indigo-800 rounded-xl">
          <p className="text-blue-900 dark:text-indigo-300 text-sm flex items-start">
            <Shield className="h-5 w-5 mr-2 text-blue-600 dark:text-indigo-400 flex-shrink-0" />
            <span>
              <strong>Privacy First:</strong> Your feedback is always anonymous. We never share personal information and use advanced encryption to protect your data.
            </span>
          </p>
        </div>
        </>
        )}
      </form>
    </div>
  )
}
