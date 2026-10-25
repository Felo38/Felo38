'use server'

import { createClient } from '@/lib/supabase/server'
import { createWebPushProvider } from './web-push'
import { dispatch, type DispatchReport } from './dispatch'
import type { Notice, PushTarget } from './types'

// Sends a push to the customer of an order. Only the customer or the branch's staff can read the
// targets (see public.push_targets_for_order), so this runs under the caller's session.
export async function pushOrderUpdate(orderId: string, notice: Notice): Promise<DispatchReport> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('push_targets_for_order', { p_order_id: orderId })
  if (error) return { 'web-push': { error: error.message } }

  const targets: PushTarget[] = (data ?? []).map((s: { endpoint: string; p256dh: string; auth_key: string }) => ({
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth: s.auth_key,
  }))
  return dispatch([createWebPushProvider()], targets, notice)
}
