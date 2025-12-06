import { NextRequest, NextResponse } from 'next/server'
import { GroupService } from '@/lib/group-service'
import { getUserFromRequest } from '@/lib/middleware'

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

    // Delete group using service
    await GroupService.deleteGroup(user.id, groupId)

    return NextResponse.json({
      message: 'Group deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete group error:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete group' },
      { status: 500 }
    )
  }
}