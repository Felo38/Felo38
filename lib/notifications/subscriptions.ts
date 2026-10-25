'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const subscriptionSchema = z.object({
  endpoint: z.url(),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(4).max(100),
})

// Stores this browser's push subscription for the signed-in user.
export async function savePushSubscription(input: z.infer<typeof subscriptionSchema>) {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.p256dh, auth_key: parsed.data.auth },
    { onConflict: 'endpoint' },
  )
  return { ok: !error }
}
