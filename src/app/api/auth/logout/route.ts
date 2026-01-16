import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    // Get token from header or cookie
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value

    if (token) {
      const auth = AuthService.verifyToken(token)

      if (auth?.userId) {
        // Log logout event
        await AuthService.logAuditEvent(auth.userId, 'USER_LOGOUT', 'User', auth.userId)
      }
    }

    // Create response that clears the auth cookie
    const response = NextResponse.json({
      message: 'Logout successful'
    })

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Immediately expire
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)

    // Still return success even if there's an error
    const response = NextResponse.json({
      message: 'Logout successful'
    })

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    })

    return response
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}