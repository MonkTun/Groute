import { createServerClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/NavBar'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
    avatarUrl = data?.avatar_url ?? null
  }

  return (
    <div className="flex min-h-full flex-col">
      <NavBar avatarUrl={avatarUrl} />
      <main className="flex-1 pt-14">{children}</main>
    </div>
  )
}
