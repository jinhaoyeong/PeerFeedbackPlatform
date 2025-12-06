'use client'

import { useState, useEffect, isValidElement, cloneElement } from 'react'
import { Bell, Check, X, MessageSquare, Users, Star } from 'lucide-react'
import { useAuth } from './auth-provider'
import { useNotifications } from './notification-provider'
import { Notification } from '@/lib/notifications'

interface NotificationDropdownProps {
  trigger: React.ReactNode
}

export function NotificationDropdown({ trigger }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications
  } = useNotifications()

  useEffect(() => {
    if (isOpen && user) {
      markAllAsRead().then(() => {
        refreshNotifications()
      }).catch(() => {
        refreshNotifications()
      })
    }
  }, [isOpen, user, refreshNotifications, markAllAsRead])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'feedback':
        return <MessageSquare className="h-4 w-4 text-indigo-600" />
      case 'group_invite':
        return <Users className="h-4 w-4 text-emerald-600" />
      case 'session_update':
        return <Star className="h-4 w-4 text-amber-500" />
      case 'session_invitation':
        return <MessageSquare className="h-4 w-4 text-purple-600" />
      case 'system':
        return <Bell className="h-4 w-4 text-slate-500" />
      default:
        return <Bell className="h-4 w-4 text-slate-500" />
    }
  }

  const formatTimeAgo = (dateInput: Date | string) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    const now = new Date()
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Just now'
    }
    const diffInMs = now.getTime() - date.getTime()
    const diffInMins = Math.floor(diffInMs / 1000 / 60)
    const diffInHours = Math.floor(diffInMins / 60)
    const diffInDays = Math.floor(diffInHours / 24)

    if (diffInMins < 1) return 'Just now'
    if (diffInMins < 60) return `${diffInMins}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${diffInDays}d ago`
  }

  return (
    <div className="relative">
      <div className="relative inline-block">
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
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bell className="h-5 w-5" />
          </button>
        )}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-indigo-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
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
          <div className="absolute right-0 top-14 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-700 z-20 overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[28rem] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                    <Bell className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${
                        !notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 mt-1 p-2 rounded-full ${
                          !notification.isRead ? 'bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                !notification.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">
                                {formatTimeAgo(notification.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.isRead && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                  className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                                  title="Mark as read"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteNotification(notification.id)
                                }}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                                title="Delete"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-sm font-medium text-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"
              >
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
