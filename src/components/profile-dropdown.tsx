'use client'

import { useState, isValidElement, cloneElement } from 'react'
import { useRouter } from 'next/navigation'
import { User, Settings, LogOut, UserCircle, Shield } from 'lucide-react'
import { useAuth } from './auth-provider'

interface ProfileDropdownProps {
  trigger: React.ReactNode
}

export function ProfileDropdown({ trigger }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logout()
      // The auth provider already handles redirecting to home page
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const navigateTo = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  return (
    <div className="relative">
      <div className="relative inline-flex">
        {isValidElement(trigger) ? (
          cloneElement(trigger as React.ReactElement<any>, {
            onClick: (e: any) => {
              e.preventDefault()
              e.stopPropagation()
              setIsOpen(!isOpen)
              const orig = (trigger as any).props?.onClick
              if (typeof orig === 'function') orig(e)
            },
            'aria-haspopup': 'menu',
            'aria-expanded': isOpen,
          } as any)
        ) : (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-700 shadow-sm">
              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{user?.fullName}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{user?.username}</div>
            </div>
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10 bg-slate-900/10 dark:bg-slate-900/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-14 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-700 z-20 overflow-hidden animate-fade-in-up">
            {/* User Info */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-700">
                  <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{user?.fullName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              <button
                onClick={() => navigateTo('/profile')}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all duration-200"
              >
                <UserCircle className="h-4.5 w-4.5" />
                <span className="text-sm font-medium">My Profile</span>
              </button>

              <button
                onClick={() => navigateTo('/settings')}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all duration-200"
              >
                <Settings className="h-4.5 w-4.5" />
                <span className="text-sm font-medium">Settings</span>
              </button>

              <button
                onClick={() => navigateTo('/privacy')}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all duration-200"
              >
                <Shield className="h-4.5 w-4.5" />
                <span className="text-sm font-medium">Privacy & Security</span>
              </button>

              
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />

            {/* Logout */}
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all duration-200"
              >
                <LogOut className="h-4.5 w-4.5" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
