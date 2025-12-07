'use client'

import { useState } from 'react'
import {
  X,
  Settings,
  Trash2,
  Edit,
  Users,
  Lock,
  Unlock,
  Save,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Loader2
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { apiClient } from '@/lib/api-client'

interface GroupSettingsPopupProps {
  isOpen: boolean
  onClose: () => void
  group: {
    id: string
    name: string
    description?: string
    isActive: boolean
    joinCode?: string
    memberCount: number
    defaultCanGiveFeedback?: boolean
    defaultCanReceiveFeedback?: boolean
    defaultCanCreateSessions?: boolean
  }
  isAdmin: boolean
  onUpdate: (updatedGroup: any) => void
  onDelete: () => void
}

export function GroupSettingsPopup({
  isOpen,
  onClose,
  group,
  isAdmin,
  onUpdate,
  onDelete
}: GroupSettingsPopupProps) {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'danger'>('general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [groupName, setGroupName] = useState(group.name)
  const [groupDescription, setGroupDescription] = useState(group.description || '')
  const [allowJoinCode, setAllowJoinCode] = useState(!!group.joinCode)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Permission states
  const [canGiveFeedback, setCanGiveFeedback] = useState(group.defaultCanGiveFeedback ?? true)
  const [canReceiveFeedback, setCanReceiveFeedback] = useState(group.defaultCanReceiveFeedback ?? true)
  const [canCreateSessions, setCanCreateSessions] = useState(group.defaultCanCreateSessions ?? false)
  const [applyToExisting, setApplyToExisting] = useState(false)

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) {
      setError('Group name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.updateGroup(group.id, {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined
      })

      if (response) {
        onUpdate({ ...response })
        setSuccess('Settings updated successfully!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/groups/${group.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          defaultCanGiveFeedback: canGiveFeedback,
          defaultCanReceiveFeedback: canReceiveFeedback,
          defaultCanCreateSessions: canCreateSessions,
          applyToExisting
        })
      })

      if (response.ok) {
        const data = await response.json()
        onUpdate({
          ...group,
          defaultCanGiveFeedback: canGiveFeedback,
          defaultCanReceiveFeedback: canReceiveFeedback,
          defaultCanCreateSessions: canCreateSessions
        })
        setSuccess('Permissions updated successfully!')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update permissions')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update permissions')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (deleteConfirmText !== group.name) {
      setError('Please type the group name correctly to confirm deletion')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/groups/${group.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      })

      if (response.ok) {
        try {
          const evt = new CustomEvent('groups:refresh', { detail: { type: 'delete', groupId: group.id } })
          window.dispatchEvent(evt)
        } catch {}
        try {
          // Best-effort socket notification so other tabs/devices update
          const { useSocket } = require('@/components/socket-provider')
          const hook = (useSocket as any)()
          if (hook?.notifyGroupDeleted) {
            hook.notifyGroupDeleted(group.id)
          }
        } catch {}
        onDelete()
        onClose()
      } else {
        const data = await response.json()
        throw new Error(data.message || 'Failed to delete group')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to delete group')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateJoinCode = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/groups/${group.id}/regenerate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        onUpdate({ ...group, joinCode: data.joinCode })
        setSuccess('Join code regenerated successfully!')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await response.json()
        throw new Error(data.message || 'Failed to regenerate join code')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to regenerate join code')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinCodeToggle = async (enabled: boolean) => {
    setAllowJoinCode(enabled)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Group Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mx-6 mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center text-emerald-800 dark:text-emerald-300 shadow-sm">
              <CheckCircle className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" />
              {success}
            </div>
          )}
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center text-red-800 dark:text-red-300 shadow-sm">
              <AlertTriangle className="h-5 w-5 mr-3 text-red-600 dark:text-red-400" />
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-700 px-6 mt-2">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-2 border-b-2 font-medium text-sm mr-6 transition-colors ${
                activeTab === 'general'
                  ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              General
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('permissions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm mr-6 transition-colors ${
                  activeTab === 'permissions'
                    ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                Permissions
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('danger')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'danger'
                    ? 'border-red-500 dark:border-red-500 text-red-600 dark:text-red-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800'
                }`}
              >
                Danger Zone
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'general' && (
              <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    disabled={!isAdmin}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    disabled={!isAdmin}
                  />
                </div>

                {isAdmin && (
                  <div className="space-y-4">

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Allow Join Code</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Members can join using the group code</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={allowJoinCode}
                          onChange={(e) => handleJoinCodeToggle(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                      </label>
                    </div>

                    {group.joinCode && allowJoinCode && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Join Code</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white mt-1">{group.joinCode}</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRegenerateJoinCode}
                            disabled={loading}
                            className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 flex items-center transition-colors shadow-sm"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors font-medium shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium"
                    >
                      {loading ? (
                        <span className="inline-flex items-center">
                          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Saving...
                        </span>
                      ) : (
                        <span className="inline-flex items-center">
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'permissions' && isAdmin && (
              <form onSubmit={handleSavePermissions} className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Default Member Permissions</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Configure what new members can do in this group by default.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <Users className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Can Give Feedback</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Members can submit feedback to others</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={canGiveFeedback}
                        onChange={(e) => setCanGiveFeedback(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Can Receive Feedback</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Members can be selected as feedback recipients</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={canReceiveFeedback}
                        onChange={(e) => setCanReceiveFeedback(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <Edit className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Can Create Sessions</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Members can start feedback sessions</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={canCreateSessions}
                        onChange={(e) => setCanCreateSessions(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">Apply to Existing Members</p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">
                        Update permissions for all current non-admin members
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={applyToExisting}
                        onChange={(e) => setApplyToExisting(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 dark:after:border-slate-600 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white shadow-sm" />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    {loading ? 'Saving...' : 'Save Permission Settings'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'danger' && isAdmin && (
              <div className="space-y-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">Delete Group</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Permanently delete this group and all its data. This action cannot be undone.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-100 dark:border-red-800 rounded-xl bg-white dark:bg-slate-800">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">Delete Group</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      This will permanently delete the group, all feedback sessions, submissions, and member data.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-600 dark:bg-red-600 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-500 transition-colors shadow-sm"
                  >
                    <Trash2 className="h-4 w-4 inline mr-2" />
                    Delete Group
                  </button>
                </div>

                {showDeleteConfirm && (
                  <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-4">Confirm Deletion</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      To confirm deletion, please type the group name exactly: <strong>{group.name}</strong>
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-4 py-2.5 border border-red-200 dark:border-red-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mb-4 bg-white dark:bg-slate-900 dark:text-white"
                      placeholder="Type group name here"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false)
                          setDeleteConfirmText('')
                        }}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteGroup}
                        disabled={loading || deleteConfirmText !== group.name}
                        className="px-4 py-2 bg-red-600 dark:bg-red-600 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-500 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {loading ? 'Deleting...' : 'Permanently Delete Group'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
