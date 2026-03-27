import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { ProfileView } from '@/components/ProfileView'

export default async function ProfilePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, sportsResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('user_sports')
      .select('sport_type, self_reported_level, strava_verified_level')
      .eq('user_id', user.id),
  ])

  const profile = profileResult.data
  const sports = sportsResult.data ?? []

  if (!profile) redirect('/onboarding')

  return <ProfileView profile={profile} sports={sports} />
}
