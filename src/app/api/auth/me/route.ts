import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'

export async function GET(request: NextRequest) {
  try {
    // Get token from header or cookie
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { message: 'No authentication token provided' },
        { status: 401 }
      )
    }

    // Verify token
    const auth = AuthService.verifyToken(token)
    if (!auth?.userId) {
      return NextResponse.json(
        { message: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get user data
    const user = await AuthService.getUserById(auth.userId)
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user,
      message: 'User retrieved successfully'
    })

  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { message: 'Failed to retrieve user information' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}