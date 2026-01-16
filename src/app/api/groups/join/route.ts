import { NextRequest, NextResponse } from 'next/server'
import { GroupService } from '@/lib/group-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { joinCode } = body

    // Join group
    const group = await GroupService.joinGroup(user.id, { joinCode })

    return NextResponse.json({
      group,
      message: 'Joined group successfully'
    })

  } catch (error: any) {
    console.error('Join group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to join group' },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  )
}