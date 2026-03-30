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

  async function signInWithGoogle() {
    setIsLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
    }
    // Browser will redirect to Google — no need to handle success here
  }

  async function resetPassword(email: string) {
    setIsLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return false
    }

    setIsLoading(false)
    return true
  }

  async function updatePassword(newPassword: string) {
    setIsLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (authError) {
      setError(authError.message)
      setIsLoading(false)
      return false
    }

    setIsLoading(false)
    return true
  }

  async function signOut() {
    setIsLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return { login, signup, signInWithGoogle, resetPassword, updatePassword, signOut, isLoading, error }
}
