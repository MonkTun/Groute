import { NextRequest, NextResponse } from 'next/server'

import { createApiClient } from '@/lib/supabase/api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await params
  const supabase = await createApiClient(request)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('activity_participants')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to leave activity:', error)
    return NextResponse.json(
      { error: 'Failed to leave activity' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: { success: true } })
}
