'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  MoreVertical,
  Play,
  Pause,
  Square,
  Edit,
  Copy,
  BarChart3,
  Trash2,
  Download,
  XCircle
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SessionActionsDropdownProps {
  session: {
    id: string
    title: string
    status: 'ACTIVE' | 'CLOSED' | 'DRAFT'
  }
  isAdmin: boolean
  groupId: string
  onUpdate: () => void
  onEdit: () => void
  onViewDetails: () => void
  onViewAnalytics: (sessionId: string) => void
}

export function SessionActionsDropdown({
  session,
  isAdmin,
  groupId,
  onUpdate,
  onEdit,
  onViewDetails,
  onViewAnalytics
}: SessionActionsDropdownProps) {
  const { token } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  // Log session data when component mounts
  useEffect(() => {
    console.log('SessionActionsDropdown received session:', session)
  }, [session])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleAction = async (action: string) => {
    setIsOpen(false)

    try {
      switch (action) {
        case 'view-details':
          onViewDetails()
          break

        case 'view-analytics':
          onViewAnalytics(session.id)
          break

        case 'edit':
          if (!isAdmin) {
            alert('Only admins can edit sessions')
            return
          }
          onEdit()
          break

        case 'start':
          if (!isAdmin) {
            alert('Only admins can start sessions')
            return
          }
          try {
            const res = await fetch(`/api/groups/${groupId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              credentials: 'include'
            })
            if (res.ok) {
              const data = await res.json()
              const count = (data?.group?.memberCount) ?? ((data?.group?.members || []).length)
              if (typeof count === 'number' && count < 3) {
                alert('At least 3 group members are required to start a session')
                return
              }
            }
          } catch {}
          console.log('=== START SESSION DEBUG ===')
          console.log('Session object:', session)
          console.log('Session ID:', session.id)
          console.log('Session ID type:', typeof session.id)
          console.log('Session status:', session.status)

          if (!session.id) {
            console.error('Session ID is undefined or null!')
            alert('Error: Session ID is missing. Please refresh the page and try again.')
            return
          }

          await updateSessionStatus('ACTIVE')
          break

        case 'pause':
          if (!isAdmin) {
            alert('Only admins can pause sessions')
            return
          }
          await updateSessionStatus('DRAFT')
          break

        case 'close':
          if (!isAdmin) {
            alert('Only admins can close sessions')
            return
          }
          setConfirmCloseOpen(true)
          break

        case 'duplicate':
          if (!isAdmin) {
            alert('Only admins can duplicate sessions')
            return
          }
          setConfirmDuplicateOpen(true)
          break

        case 'export':
          await exportSession()
          break

        case 'delete':
          if (!isAdmin) {
            alert('Only admins can delete sessions')
            return
          }
          setConfirmDeleteOpen(true)
          break
      }
    } catch (error: any) {
      alert(error.message || 'Failed to perform action')
    }
  }

  const updateSessionStatus = async (status: string) => {
    console.log('=== UPDATE SESSION STATUS DEBUG ===')
    console.log('Session ID:', session.id)
    console.log('Status to update:', status)
    console.log('Has token:', !!token)

    if (!session.id) {
      throw new Error('Session ID is required')
    }

    const url = `/api/feedback/sessions/${session.id}`
    const body = JSON.stringify({ status })

    console.log('Request URL:', url)
    console.log('Request body:', body)

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include',
      body
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', response.headers.get('content-type'))

    if (!response.ok) {
      let errorMessage = `Failed to update session status (${response.status})`

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
          console.error('Error response:', errorData)
        } else {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
          console.error('Error response (text):', errorText)
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
      }

      throw new Error(errorMessage)
    }

    onUpdate()
  }

  const duplicateSession = async () => {
    const response = await fetch(`/api/feedback/sessions/${session.id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include'
    })

    if (!response.ok) {
      let errorMessage = 'Failed to duplicate session'

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } else {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
      } catch (parseError) {
        // Use default error message if parsing fails
      }

      throw new Error(errorMessage)
    }

    onUpdate()
  }

  const exportSession = async () => {
    const response = await fetch(`/api/feedback/sessions/${session.id}/export`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include'
    })

    if (!response.ok) {
      let errorMessage = 'Failed to export session'

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } else {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
      } catch (parseError) {
        // Use default error message if parsing fails
      }

      throw new Error(errorMessage)
    }

    // Download the file
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const deleteSession = async () => {
    const response = await fetch(`/api/feedback/sessions/${session.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include'
    })

    if (!response.ok) {
      let errorMessage = 'Failed to delete session'

      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } else {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
      } catch (parseError) {
        // Use default error message if parsing fails
      }

      throw new Error(errorMessage)
    }

    onUpdate()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-xl z-50 border border-slate-100 dark:border-slate-700 transform transition-all animate-in fade-in zoom-in-95 duration-200">
          <div className="p-1.5">
            <button
              onClick={() => handleAction('view-details')}
              className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              <BarChart3 className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
              View Details
            </button>

            <button
              onClick={() => handleAction('view-analytics')}
              className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              <BarChart3 className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
              View Analytics
            </button>


            {isAdmin && (
              <>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-2"></div>
                <button
                  onClick={() => handleAction('edit')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  <Edit className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
                  Edit Session
                </button>

                {session.status === 'DRAFT' && (
                  <button
                    onClick={() => handleAction('start')}
                    className="flex items-center w-full px-3 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors font-medium"
                  >
                    <Play className="h-4 w-4 mr-3" />
                    Start Session
                  </button>
                )}

                {session.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleAction('pause')}
                    className="flex items-center w-full px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-colors font-medium"
                  >
                    <Pause className="h-4 w-4 mr-3" />
                    Pause Session
                  </button>
                )}

                {session.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleAction('close')}
                    className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                  >
                    <Square className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
                    Close Session
                  </button>
                )}

                <button
                  onClick={() => handleAction('duplicate')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  <Copy className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
                  Duplicate Session
                </button>

                <button
                  onClick={() => handleAction('export')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  <Download className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
                  Export Results
                </button>
              </>
            )}

            {isAdmin && (
              <>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-2"></div>
                <button
                  onClick={() => handleAction('delete')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
                >
                  <Trash2 className="h-4 w-4 mr-3" />
                  Delete Session
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {confirmDuplicateOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Duplicate Session</h2>
              <button onClick={() => setConfirmDuplicateOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-slate-700 dark:text-slate-300">Create a copy of "{session.title}"?</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDuplicateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { setConfirmDuplicateOpen(false); await duplicateSession() }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Create Copy
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmCloseOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Close Session</h2>
              <button onClick={() => setConfirmCloseOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-slate-700 dark:text-slate-300">Are you sure you want to close "{session.title}"?</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmCloseOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { setConfirmCloseOpen(false); await updateSessionStatus('CLOSED') }}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
                >
                  Close Session
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDeleteOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Session</h2>
              <button onClick={() => setConfirmDeleteOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-slate-700 dark:text-slate-300">This will permanently delete "{session.title}" and its data. This action cannot be undone.</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDeleteOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { setConfirmDeleteOpen(false); await deleteSession() }}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Delete Session
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
