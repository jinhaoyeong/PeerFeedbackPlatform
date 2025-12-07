import { useAuth } from '@/components/auth-provider'

const API_BASE_URL = process.env.NODE_ENV === 'production' ? '' : ''

export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/api${endpoint}`

    const defaultHeaders = {
      'Content-Type': 'application/json',
    }

    // Get token from localStorage or cookies
    const token = this.getAuthToken()
    if (token) {
      (defaultHeaders as any)['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        credentials: 'include',
      })

      let data: any = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {

        if (response.status === 401) {
          // For 401 errors, return empty object to avoid breaking components
          // Components should handle empty responses gracefully
          return (data || {}) as T
        }
        if (response.status === 404) {
          // Handle 404 errors gracefully
          const errorMessage = (data && (data.message || data.error)) || 'Resource not found'
          throw new Error(errorMessage)
        }
        const errorMessage = (data && (data.message || data.error)) || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }

      return data as T
    } catch (error) {
      const msg = (error as any)?.message || ''
      const lower = String(msg).toLowerCase()
      const suppress = (
        lower.includes('authentication required') ||
        lower.includes('group not found') ||
        lower.includes('failed to retrieve group') ||
        lower.includes('resource not found')
      )
      if (!suppress) {
        console.error(`API Error (${endpoint}):`, error)
      }
      throw error
    }
  }

  private getAuthToken(): string | null {
    // Try to get token from localStorage first
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token')
    }
    return null
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(userData: {
    email: string
    username: string
    password: string
    fullName: string
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  async getCurrentUser() {
    return this.request('/auth/me', {
      method: 'GET',
    })
  }

  // Group endpoints
  async getGroups() {
    return this.request('/groups', {
      method: 'GET',
    })
  }

  async createGroup(groupData: {
    name: string
    description?: string
  }) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(groupData),
    })
  }

  async joinGroup(joinCode: string) {
    return this.request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    })
  }

  async getGroup(groupId: string) {
    return this.request(`/groups/${groupId}`, {
      method: 'GET',
    })
  }

  async updateGroup(groupId: string, data: {
    name?: string
    description?: string
    isActive?: boolean
  }) {
    return this.request(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async leaveGroup(groupId: string) {
    return this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    })
  }

  // Feedback session endpoints
  async getSessions(groupId: string) {
    return this.request(`/feedback/sessions?groupId=${groupId}`, {
      method: 'GET',
    })
  }

  async createSession(sessionData: {
    groupId: string
    title: string
    description?: string
    startsAt?: Date
    endsAt?: Date
    allowSelfFeedback?: boolean
    allowAnonymousFeedback?: boolean
    notifyOnCreate?: boolean
  }) {
    return this.request('/feedback/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    })
  }

  async getSession(sessionId: string) {
    return this.request(`/feedback/sessions/${sessionId}`, {
      method: 'GET',
    })
  }

  async updateSessionStatus(sessionId: string, status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED') {
    if (!sessionId) {
      console.error('API Client: Session ID is required for updateSessionStatus')
      throw new Error('Session ID is required')
    }
    console.log(`API Client: Updating session ${sessionId} to status ${status}`)
    return this.request(`/feedback/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  async updateSession(sessionId: string, data: {
    title?: string
    description?: string
    startsAt?: Date
    endsAt?: Date
    allowSelfFeedback?: boolean
    allowAnonymousFeedback?: boolean
  }) {
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    return this.request(`/feedback/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async extendSession(sessionId: string, endsAt?: Date) {
    return this.request(`/feedback/sessions/${sessionId}/extend`, {
      method: 'PUT',
      body: JSON.stringify({ endsAt }),
    })
  }

  // Feedback endpoints
  async submitFeedback(feedbackData: {
    sessionId: string
    targetUserId: string
    content: string
  }) {
    return this.request('/feedback/submit', {
      method: 'POST',
      body: JSON.stringify(feedbackData),
    })
  }

  async getUserFeedback(userId: string) {
    return this.request(`/feedback/user/${userId}`, {
      method: 'GET',
    })
  }

  async getSessionFeedback(sessionId: string) {
    return this.request(`/feedback/sessions/${sessionId}/feedback`, {
      method: 'GET',
    })
  }

  // Analytics endpoints
  async getDashboardStats() {
    return this.request('/analytics?type=dashboard', {
      method: 'GET',
    })
  }

  async getAnalyticsData(timeRange: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    return this.request(`/analytics?type=analytics&timeRange=${timeRange}`, {
      method: 'GET',
    })
  }

  async getSessionAnalytics(sessionId: string) {
    return this.request(`/feedback/sessions/${sessionId}/analytics`, {
      method: 'GET',
    })
  }
}

export const apiClient = new ApiClient()

// Hook for using API client with auth
export function useApi() {
  const { token } = useAuth()
  return apiClient
}
