import { createBrowserClient } from '@supabase/ssr'

// Browser client, used only for Realtime subscriptions. RLS applies to every row it receives.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
