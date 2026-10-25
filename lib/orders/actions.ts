'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { errorKey } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

const localeSchema = z.enum(['ar', 'en']).catch('ar')
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const lineSchema = z.array(
  z.object({ productId: z.guid(), quantity: z.number().int().min(1).max(20) }),
).min(1).max(50)

// Customer places an order. Prices and totals are computed in the database, not taken from the form.
export async function placeOrderAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const type = z.enum(['pickup_asap', 'pickup_scheduled', 'reservation']).safeParse(formData.get('type'))
  const branch = z.string().regex(/^[a-z0-9-]+$/).safeParse(formData.get('branch'))
  const lines = lineSchema.safeParse(JSON.parse(String(formData.get('payload') ?? '[]') || '[]'))
  const redeem = z.coerce.number().int().min(0).safeParse(formData.get('redeem') || 0)
  const timeRaw = String(formData.get('scheduled') ?? '')
  const scheduled = timeRaw === '' ? null : LOCAL_TIME.test(timeRaw) ? timeRaw.replace('T', ' ') : undefined

  if (!type.success || !branch.success || !lines.success || !redeem.success || scheduled === undefined) {
    redirect(`/${locale}/cart?error=input`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/cart`)}`)

  const { data, error } = await supabase.rpc('place_order', {
    p_branch_slug: branch.data,
    p_type: type.data,
    p_scheduled_local: type.data === 'pickup_asap' ? null : scheduled,
    p_items: lines.data.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
    p_redeem_points: redeem.data,
  })
  if (error) redirect(`/${locale}/cart?error=${errorKey(error.message)}`)

  redirect(`/${locale}/orders/${data}?placed=1`)
}

export async function cancelOrderAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const orderId = z.guid().safeParse(formData.get('order_id'))
  if (!orderId.success) redirect(`/${locale}/orders`)

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId.data,
    p_reason: String(formData.get('reason') ?? '').trim() || 'Cancelled by customer',
  })
  if (error) redirect(`/${locale}/orders/${orderId.data}?error=${errorKey(error.message)}`)
  redirect(`/${locale}/orders/${orderId.data}?cancelled=1`)
}

export async function markNotificationsReadAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  }
  redirect(`/${locale}/orders`)
}
