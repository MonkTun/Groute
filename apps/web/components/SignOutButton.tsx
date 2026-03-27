'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const { signOut, isLoading } = useAuth()

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={isLoading}>
      {isLoading ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}
