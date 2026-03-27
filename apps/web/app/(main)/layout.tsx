import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold">Groute</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.user_metadata?.display_name ?? user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
