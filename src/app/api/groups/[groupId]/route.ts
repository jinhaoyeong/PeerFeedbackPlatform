import { NextRequest, NextResponse } from 'next/server'
import { GroupService } from '@/lib/group-service'
import { getUserFromRequest } from '@/lib/middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const resolvedParams = await params
    console.log('Group API called:', { groupId: resolvedParams.groupId, url: request.url })

    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      console.log('No authenticated user found')
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { groupId } = resolvedParams
    console.log('User authenticated:', { userId: user.id, groupId })

    // Get group details
    const group = await GroupService.getGroupById(user.id, groupId)
    console.log('Group retrieved:', !!group)

    if (!group) {
      return NextResponse.json(
        { message: 'Group not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      group,
      message: 'Group retrieved successfully'
    })

  } catch (error: any) {
    console.error('Get group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to retrieve group' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { groupId } = await params
    const body = await request.json()
    const { name, description, isActive } = body

    // Update group settings
    const group = await GroupService.updateGroupSettings(user.id, groupId, {
      name,
      description,
      isActive
    })

    return NextResponse.json({
      group,
      message: 'Group updated successfully'
    })

  } catch (error: any) {
    console.error('Update group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update group' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { groupId } = await params

    // Leave group
    await GroupService.leaveGroup(user.id, groupId)

    return NextResponse.json({
      message: 'Left group successfully'
    })

  } catch (error: any) {
    console.error('Leave group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to leave group' },
      { status: 400 }
    )
  }
}