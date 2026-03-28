'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserClient } from '@/lib/supabase/client'

export function useAuth() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient()

  async function login(email: string, password: string) {
    setIsLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return
    }

    router.push('/rightnow')
    router.refresh()
  }

  async function signup(email: string, password: string, displayName: string) {
    setIsLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return
    }

    router.push('/rightnow')
    router.refresh()
  }

  async function signOut() {
    setIsLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return { login, signup, signOut, isLoading, error }
}
