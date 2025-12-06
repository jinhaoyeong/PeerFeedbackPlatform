import { NextRequest } from 'next/server'
import { AuthService } from './auth-service'

export async function verifyAuth(request: NextRequest): Promise<{ userId: string } | null> {
  try {
    // Get token from header or cookie
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('auth-token')?.value

    let token = authHeader?.replace('Bearer ', '') || cookieToken

    if (!token) {
      return null
    }

    // Verify token
    const payload = AuthService.verifyToken(token)
    return payload
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export async function getUserFromRequest(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth?.userId) {
    return null
  }

  return await AuthService.getUserById(auth.userId)
}