import { createClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'

import { createServerClient } from './server'

/**
 * Create a Supabase client that supports both:
 * - Cookie-based auth (web frontend via SSR)
 * - Bearer token auth (mobile app via Authorization header)
 */
export async function createApiClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )
  }

  return createServerClient()
}
