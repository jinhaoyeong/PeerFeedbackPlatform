'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Calendar, Users, MessageSquare, Bell, Clock, Settings, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from './auth-provider'
import { FeedbackService } from '@/lib/feedback'
import { apiClient } from '@/lib/api-client'
// import { toast } from 'sonner' // Using console.log for now since sonner might not be available

const createSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required'),
  description: z.string().optional(),
  groupId: z.string().min(1, 'Please select a group'),
  allowAnonymousFeedback: z.boolean(),
  hasEndDate: z.boolean(),
  endDate: z.string().optional(),
  notifyOnCreate: z.boolean(),
})

type CreateSessionForm = z.infer<typeof createSessionSchema>

interface CreateFeedbackSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (session: any) => void
}

export function CreateFeedbackSessionModal({
  isOpen,
  onClose,
  onSuccess
}: CreateFeedbackSessionModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [userGroups, setUserGroups] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<CreateSessionForm>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      name: '',
      groupId: '',
      allowAnonymousFeedback: true,
      hasEndDate: false,
      description: '',
      endDate: '',
      notifyOnCreate: false
    }
  })

  const hasEndDate = watch('hasEndDate')

  const loadUserGroups = async () => {
    if (!user) return
    try {
      const res: any = await apiClient.getGroups()
      let groups = (res as any)?.groups || []
      const adminGroups = groups.filter((g: any) => {
        const role = g.currentUserRole || g.members?.find?.((m: any) => m.userId === user.id)?.role
        return role === 'ADMIN'
      })
      setUserGroups(adminGroups)
    } catch (error) {
      console.error('Error loading user groups:', error)
    }
  }

  const onSubmit = async (data: CreateSessionForm) => {
    if (!user) return

    setLoading(true)

    try {
      const payload = {
        groupId: data.groupId,
        title: data.name,
        description: data.description,
        startsAt: new Date(),
        endsAt: data.hasEndDate && data.endDate ? new Date(data.endDate) : undefined,
        allowSelfFeedback: true,
        allowAnonymousFeedback: !!data.allowAnonymousFeedback,
        notifyOnCreate: !!data.notifyOnCreate
      }

      const res: any = await apiClient.createSession(payload)
      const session = (res as any)?.session || res

      if (onSuccess) {
        onSuccess(session)
      }

      reset()
      onClose()
    } catch (error) {
      console.error('Error creating feedback session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    loadUserGroups()
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('user-settings') : null
      const s = raw ? JSON.parse(raw) : {}
      const allowAnon = s.allowAnonymousFeedback !== false
      reset({
        name: '',
        groupId: '',
        allowAnonymousFeedback: allowAnon,
        hasEndDate: false,
        description: '',
        endDate: '',
        notifyOnCreate: false
      })
    } catch {
      reset()
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // Load groups and defaults when modal opens
  useEffect(() => {
    if (isOpen) handleOpen()
  }, [isOpen])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <MessageSquare className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Create Feedback Session
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Session Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Session Name *
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              placeholder="e.g., Q4 Team Feedback"
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              placeholder="Optional description of the feedback session"
            />
          </div>

          {/* Group Selection */}
          <div>
            <label htmlFor="groupId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Group *
            </label>
            <select
              id="groupId"
              {...register('groupId')}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">Select a group</option>
              {userGroups.map((group: any) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.memberCount ?? group._count?.members ?? 0} members)
                </option>
              ))}
              {userGroups.length === 0 && (
                <option value="" disabled>
                  No admin groups available
                </option>
              )}
            </select>
            {errors.groupId && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.groupId.message}</p>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center">
            <Settings className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            Session Settings
          </h3>

          {/* Notify Participants on Creation */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Notify on Session Creation</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Send invitations to group members</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                {...register('notifyOnCreate')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

            {/* Allow Anonymous Feedback */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Anonymous Feedback</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Allow participants to submit anonymously</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('allowAnonymousFeedback')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* End Date */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">End Date</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set an end date for this session</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('hasEndDate')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {hasEndDate && (
              <div className="ml-11">
                <input
                  type="datetime-local"
                  {...register('endDate', {
                    required: hasEndDate ? 'End date is required' : false
                  })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                {errors.endDate && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.endDate.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-white bg-indigo-600 dark:bg-indigo-600 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-medium hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Session'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
