'use client'

import { useState } from 'react'
import { X, Users, Hash, Calendar, Settings, Plus, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/components/auth-provider'
import { useSocket } from '@/components/socket-provider'

interface GroupModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'join'
}

export function GroupModal({ isOpen, onClose, mode }: GroupModalProps) {
  const { user } = useAuth()
  const { notifyMemberJoinedGroup, joinGroup, notifyGroupCreated } = useSocket()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    joinCode: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (mode === 'create') {
      if (!formData.name.trim()) {
        newErrors.name = 'Group name is required'
      } else if (formData.name.trim().length < 3) {
        newErrors.name = 'Group name must be at least 3 characters'
      }

      if (formData.description && formData.description.trim().length > 500) {
        newErrors.description = 'Description must be 500 characters or less'
      }
    } else {
      if (!formData.joinCode.trim()) {
        newErrors.joinCode = 'Join code is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      let response: any
      if (mode === 'create') {
        response = await apiClient.createGroup({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        })
        if (response?.group?.id && user) {
          joinGroup(response.group.id)
          notifyGroupCreated(response.group)
        }
      } else {
        // Real group joining using API client
        response = await apiClient.joinGroup(formData.joinCode.trim())

        // Join the new group's room and emit event for real-time update
        if (response?.group?.id && user) {
          const memberInfo = {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            joinedAt: new Date().toISOString()
          }

          console.log('Emitting member joined group event:', { groupId: response.group.id, memberInfo })
          joinGroup(response.group.id)
          notifyMemberJoinedGroup(response.group.id, memberInfo)
        }
      }

      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('groups:refresh', {
            detail: {
              type: mode,
              group: response?.group || null
            }
          }))
        }
      } catch {}

      onClose()
      // Reset form
      setFormData({ name: '', description: '', joinCode: '' })
      // Dashboard will update via real-time event; no full page reload needed
    } catch (error) {
      console.error('Group operation error:', error)
      const errorMessage = error instanceof Error ? error.message :
        (mode === 'create' ? 'Failed to create group' : 'Failed to join group')
      setErrors({ submit: errorMessage })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              {mode === 'create' ? (
                <Plus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Hash className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {mode === 'create' ? 'Create New Group' : 'Join Group'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {mode === 'create' ? (
            <div className="space-y-5">
              {/* Group Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Group Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                    errors.name ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
                  }`}
                  placeholder="e.g., Design Team Feedback"
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                    errors.description ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
                  }`}
                  placeholder="Describe the purpose of this group..."
                  disabled={isSubmitting}
                />
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  Optional. Help members understand what this group is for.
                </p>
                {errors.description && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                )}
              </div>

              {/* Features Info */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">What you'll get:</h4>
                <ul className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1.5">
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Unique join code for inviting members</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Ability to create feedback sessions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Member management and permissions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>Session analytics and insights</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Join Code */}
              <div>
                <label htmlFor="joinCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Join Code *
                </label>
                <div className="relative">
                  <Hash className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="joinCode"
                    name="joinCode"
                    type="text"
                    value={formData.joinCode}
                    onChange={handleInputChange}
                    className={`w-full pl-11 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-lg transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                      errors.joinCode ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="ABC123"
                    disabled={isSubmitting}
                  />
                </div>
                {errors.joinCode && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.joinCode}</p>
                )}
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  Enter the join code provided by the group administrator.
                </p>
              </div>

              {/* Info */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">Before joining:</h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1.5">
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Make sure you have the correct join code</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>You'll be able to receive feedback from group members</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Your activity will be visible to the group administrator</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-medium hover:-translate-y-0.5"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  {mode === 'create' ? 'Creating...' : 'Joining...'}
                </div>
              ) : (
                mode === 'create' ? 'Create Group' : 'Join Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
