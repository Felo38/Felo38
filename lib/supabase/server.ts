import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'

// Server-side Supabase client, bound to the current request's cookies.
// Every query runs as the signed-in user, so RLS applies.
export async function createClient() {
  const cookieStore = await cookies()
  const env = getEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  })
}
