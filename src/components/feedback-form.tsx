'use client'

import { useState, useMemo } from 'react'
import { useAuth } from './auth-provider'
import { MessageSquare, Send, Star, AlertCircle, Eye, EyeOff, XCircle, Info, CheckCircle2 } from 'lucide-react'

interface FeedbackFormProps {
  sessionId: string
  targetUserId: string
  targetUserName: string
  sessionTitle: string
  onSubmit: (feedback: string) => Promise<void>
  onCancel: () => void
  allowAnonymous?: boolean
}

export function FeedbackForm({
  sessionId,
  targetUserId,
  targetUserName,
  sessionTitle,
  onSubmit,
  onCancel,
  allowAnonymous
}: FeedbackFormProps) {
  const { user } = useAuth()
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [charCount, setCharCount] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const minCharacters = 10
  const maxCharacters = 2500

  const allowAnonymousComputed = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('user-settings') : null
      const s = raw ? JSON.parse(raw) : {}
      return s.allowAnonymousFeedback !== false
    } catch {
      return true
    }
  }, [])
  const effectiveAllowAnonymous = useMemo(() => {
    if (typeof allowAnonymous === 'boolean') return allowAnonymous
    return allowAnonymousComputed
  }, [allowAnonymous, allowAnonymousComputed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (feedback.trim().length < minCharacters) {
      setError(`Feedback must be at least ${minCharacters} characters long`)
      return
    }

    if (feedback.trim().length > maxCharacters) {
      setError(`Feedback must be ${maxCharacters} characters or less`)
      return
    }

    if (!effectiveAllowAnonymous && !confirmOpen) {
      setConfirmOpen(true)
      return
    }

    await submitNow()
  }

  const submitNow = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit(feedback.trim())
      setFeedback('')
      setCharCount(0)
      setConfirmOpen(false)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit feedback. Please try again.'
      if (errorMessage.includes('has ended')) {
        setError('This feedback session has ended. Please contact the group admin to extend the session.')
      } else if (errorMessage.includes('not started yet')) {
        setError('This feedback session has not started yet. Please wait for it to begin.')
      } else if (errorMessage.includes('not currently active')) {
        setError('This feedback session is not currently active. Please contact the group admin.')
      } else if (errorMessage.includes('Authentication required')) {
        setError('This session requires non-anonymous feedback. Please log in and try again.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setFeedback(value)
    setCharCount(value.length)
    if (error) setError('')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Submit Feedback
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-11">
            Providing feedback to <span className="font-semibold text-slate-900 dark:text-white">{targetUserName}</span>
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <XCircle className="h-6 w-6" />
        </button>
      </div>

      {/* Session Info */}
      <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-5 mb-8 flex items-start space-x-3">
        <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-1">Session: {sessionTitle}</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-400 leading-relaxed">
            {effectiveAllowAnonymous
              ? 'Your feedback will be anonymous. Please focus on constructive and specific observations.'
              : 'This session requires non-anonymous feedback. Your name will be included with your submission.'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Anonymous Indicator */}
        <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>
          <span className="font-medium">{effectiveAllowAnonymous ? 'This feedback can be submitted anonymously' : 'Your name will be visible to the recipient'}</span>
        </div>

        {!effectiveAllowAnonymous && (
          <div className="flex items-start space-x-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">This feedback will include your name. It is not anonymous.</span>
          </div>
        )}

        {/* Feedback Textarea */}
        <div>
          <label htmlFor="feedback" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Your Feedback <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <textarea
              id="feedback"
              value={feedback}
              onChange={handleFeedbackChange}
              rows={8}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-700 dark:text-white bg-white dark:bg-slate-900 ${
                error ? 'border-red-300 dark:border-red-800 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
              placeholder="Share your constructive feedback here. Be specific, actionable, and kind..."
              disabled={isSubmitting}
            />
            <div className="absolute bottom-3 right-3 text-xs font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700 shadow-sm text-slate-400 dark:text-slate-400">
              {charCount} / {maxCharacters}
            </div>
          </div>

          {/* Character Counter & Limits */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-2">
              <span className={`flex items-center ${charCount < minCharacters ? 'text-amber-600 dark:text-amber-500 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                {charCount < minCharacters && <AlertCircle className="h-3 w-3 mr-1" />}
                Min: {minCharacters}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className={`flex items-center ${charCount > maxCharacters ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                {charCount > maxCharacters && <AlertCircle className="h-3 w-3 mr-1" />}
                Max: {maxCharacters}
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* Preview Toggle */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
          >
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors flex items-center">
              {showPreview ? <EyeOff className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" /> : <Eye className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </span>
          </button>

          {/* Preview Content */}
          {showPreview && (
            <div className="bg-white dark:bg-slate-800 p-6 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                    allowAnonymous ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {effectiveAllowAnonymous ? '?' : (user?.fullName || user?.username || 'Y').slice(0,1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {effectiveAllowAnonymous ? 'Anonymous' : (user?.fullName || user?.username || 'You')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Previewing feedback for {targetUserName}</div>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                {feedback.trim() || <span className="text-slate-400 dark:text-slate-600 italic">Start typing to see preview...</span>}
              </div>
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center">
            <Star className="h-4 w-4 mr-2 text-amber-500 fill-amber-500" />
            Guidelines for Great Feedback
          </h4>
          <ul className="text-sm text-amber-800/80 dark:text-amber-400/80 space-y-2 ml-1">
            <li className="flex items-start">
              <span className="mr-2 text-amber-400">•</span>
              Be specific and concrete with examples
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-amber-400">•</span>
              Focus on behavior and actions, not personality
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-amber-400">•</span>
              Provide balanced feedback (strengths + areas for improvement)
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-amber-400">•</span>
              Keep it professional and respectful
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex space-x-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || charCount < minCharacters || charCount > maxCharacters}
            className="flex-1 px-4 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center font-semibold"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm Non-Anonymous Submission</h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">This session does not allow anonymous feedback. Your name will be attached to this submission. Do you want to proceed?</p>
            </div>
            <div className="p-6 flex space-x-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNow}
                className="flex-1 px-4 py-3 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500"
              >
                Confirm and Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
