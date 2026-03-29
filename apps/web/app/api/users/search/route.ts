import { NextRequest, NextResponse } from 'next/server'

import { createApiClient } from '@/lib/supabase/api'

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] })
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name, avatar_url, area')
    .or(
      `display_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
    )
    .neq('id', user.id)
    .limit(20)

  if (error) {
    console.error('Failed to search users:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: users ?? [] })
}
