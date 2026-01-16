'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, UserMinus, MessageSquare, ShieldCheck, Eye } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface MemberActionsDropdownProps {
  member: {
    id: string
    fullName: string
    username: string
    role: string
  }
  currentUserId: string
  currentUserRole: string
  groupId: string
  onUpdate: () => void
}

export function MemberActionsDropdown({
  member,
  currentUserId,
  currentUserRole,
  groupId,
  onUpdate
}: MemberActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { token } = useAuth()
  const router = useRouter()
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const toggleOpen = () => {
    const next = !isOpen
    setIsOpen(next)
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 224
      const padding = 8
      const top = rect.bottom + padding + window.scrollY
      let left = rect.right - menuWidth + window.scrollX
      left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding))
      setMenuPos({ top, left })
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle scroll to close dropdown
  useEffect(() => {
    const handleScroll = () => setIsOpen(false)
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [])

  const updateMemberRole = async (newRole: string) => {
    const response = await fetch(`/api/groups/${groupId}/members/${member.id}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ role: newRole })
    })

    if (!response.ok) {
      throw new Error('Failed to update role')
    }

    onUpdate()
  }

  const handleAction = async (action: string) => {
    setIsOpen(false)

    try {
      switch (action) {
        case 'view-profile':
          router.push(`/profile/${member.username}`)
          break

        case 'send-message':
          try {
            const res = await fetch(`/api/user/settings?userId=${member.id}`, {
              method: 'GET',
              headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              credentials: 'include'
            })
            if (res.ok) {
              const data = await res.json()
              const allowMessaging = typeof data?.settings?.allowMessaging === 'undefined' ? true : !!data.settings.allowMessaging
              if (!allowMessaging) {
                alert('This member has disabled messaging')
                return
              }
            }
            const evt = new CustomEvent('dm:open', { detail: { userId: member.id, username: member.username, fullName: member.fullName } })
            window.dispatchEvent(evt)
          } catch {}
          break

        case 'change-role':
          if (currentUserRole !== 'ADMIN') {
            alert('Only admins can change roles')
            return
          }
          const newRole = member.role === 'ADMIN' ? 'MEMBER' : 'MODERATOR'
          await updateMemberRole(newRole)
          break

        case 'remove-member':
          if (currentUserRole !== 'ADMIN') {
            alert('Only admins can remove members')
            return
          }
          if (confirm(`Are you sure you want to remove ${member.fullName} from the group?`)) {
            await removeMember()
          }
          break
      }
    } catch (error: any) {
      alert(error.message || 'Failed to perform action')
    }
  }

  const removeMember = async () => {
    const response = await fetch(`/api/groups/${groupId}/members/${member.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to remove member')
    }

    onUpdate()
  }

  const canChangeRole = currentUserRole === 'ADMIN' && member.id !== currentUserId
  const canRemove = currentUserRole === 'ADMIN' && member.id !== currentUserId
  const isOwner = member.role === 'ADMIN'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
          className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-xl dark:shadow-black/20 z-50 border border-slate-100 dark:border-slate-700 transform transition-all animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-1.5">
            <button
              onClick={() => handleAction('view-profile')}
              className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              <Eye className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
              View Profile
            </button>

            <button
              onClick={() => handleAction('send-message')}
              className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
            >
              <MessageSquare className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
              Send Message
            </button>

            {canChangeRole && (
              <>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-2"></div>
                <button
                  onClick={() => handleAction('change-role')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                  {member.role === 'ADMIN' ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-3 text-slate-400 dark:text-slate-500" />
                      Remove Admin
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-3 text-indigo-600 dark:text-indigo-400" />
                      Make Moderator
                    </>
                  )}
                </button>
              </>
            )}

            {canRemove && !isOwner && (
              <>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5 mx-2"></div>
                <button
                  onClick={() => handleAction('remove-member')}
                  className="flex items-center w-full px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium"
                >
                  <UserMinus className="h-4 w-4 mr-3" />
                  Remove from Group
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
