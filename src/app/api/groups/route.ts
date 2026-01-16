import { NextRequest, NextResponse } from 'next/server'
import { GroupService } from '@/lib/group-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's groups
    const groups = await GroupService.getUserGroups(user.id)

    return NextResponse.json({
      groups,
      message: 'Groups retrieved successfully'
    })

  } catch (error: any) {
    console.error('Get groups error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve groups' },
      { status: 500 }
    )
  }
}

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
    const { name, description } = body

    // Create group
    const group = await GroupService.createGroup(user.id, {
      name,
      description
    })

    return NextResponse.json({
      group,
      message: 'Group created successfully'
    }, { status: 201 })

  } catch (error: any) {
    console.error('Create group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create group' },
      { status: 400 }
    )
  }
}