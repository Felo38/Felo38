'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { errorKey } from '@/lib/errors'
import { getCurrentProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { pushOrderUpdate } from '@/lib/notifications/server'
import { orderNotice } from '@/lib/orders/notice'
import { STAFF_MOVES, type OrderStatus } from '@/lib/orders/status'

const localeSchema = z.enum(['ar', 'en']).catch('ar')
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const SLUG = /^[a-z0-9-]+$/

// The lookup (qr=... or phone=...) is carried through the redirect so the desk can show the same customer again.
function lookupQuery(formData: FormData): string {
  const v = String(formData.get('lookup') ?? '')
  return /^(qr|phone)=[^&]{1,300}$/.test(v) ? v : ''
}

async function staffOrRedirect(locale: string) {
  const profile = await getCurrentProfile()
  if (!profile || (profile.role !== 'branch_staff' && profile.role !== 'admin')) {
    redirect(`/${locale}/staff/login`)
  }
  return profile
}

// Staff move an order. The flow is checked here and again in the database.
export async function transitionOrderAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const back = String(formData.get('back') ?? `/${locale}/branch`)
  await staffOrRedirect(locale)

  const orderId = z.guid().safeParse(formData.get('order_id'))
  const to = z.enum(['accepted', 'preparing', 'ready', 'picked_up', 'rejected', 'rescheduled']).safeParse(formData.get('to'))
  if (!orderId.success || !to.success) redirect(`${back}?error=input`)

  const timeRaw = String(formData.get('ready_local') ?? '')
  const readyLocal = LOCAL_TIME.test(timeRaw) ? timeRaw.replace('T', ' ') : null
  const reason = String(formData.get('reason') ?? '').trim() || null

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('order_no, status')
    .eq('id', orderId.data)
    .maybeSingle()
  if (!order) redirect(`${back}?error=move`)
  if (!STAFF_MOVES[order.status as OrderStatus].includes(to.data)) redirect(`${back}?error=move`)

  const { error } = await supabase.rpc('transition_order', {
    p_order_id: orderId.data,
    p_to: to.data,
    p_reason: reason,
    p_ready_local: readyLocal,
  })
  if (error) redirect(`${back}?error=${errorKey(error.message)}`)

  // Push is best-effort. The in-app notification is already saved by the database.
  await pushOrderUpdate(orderId.data, orderNotice(to.data, order.order_no, locale))
  revalidatePath(`/${locale}/branch`)
  redirect(`${back}?updated=1`)
}

// Toggle a product at this branch. RLS allows staff to change only their own branch's rows.
export async function setStockAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const back = String(formData.get('back') ?? `/${locale}/branch`)
  const profile = await staffOrRedirect(locale)

  const productId = z.guid().safeParse(formData.get('product_id'))
  const branchId = profile.branch_id ?? z.guid().safeParse(formData.get('branch_id')).data
  if (!productId.success || !branchId) redirect(`${back}?error=input`)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branch_products')
    .update({
      available: formData.get('available') === 'on',
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('branch_id', branchId)
    .eq('product_id', productId.data)
    .select('product_id')
  if (error || !data?.length) redirect(`${back}?error=forbidden`)

  revalidatePath(`/${locale}/branch`)
  revalidatePath(`/${locale}/menu`)
  redirect(`${back}?updated=1`)
}

export async function addReceiptAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  await staffOrRedirect(locale)
  const back = `/${locale}/branch/points`

  const parsed = z.object({
    customer_id: z.guid(),
    branch: z.string().regex(SLUG),
    receipt_no: z.string().trim().min(1).max(40),
    coffee: z.coerce.number().min(0).max(100000),
    food: z.coerce.number().min(0).max(100000),
  }).safeParse({
    customer_id: formData.get('customer_id'),
    branch: formData.get('branch'),
    receipt_no: formData.get('receipt_no'),
    coffee: formData.get('coffee') || 0,
    food: formData.get('food') || 0,
  })
  if (!parsed.success) redirect(`${back}?error=input`)
  const d = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_in_store_points', {
    p_customer: d.customer_id,
    p_branch_slug: d.branch,
    p_receipt_no: d.receipt_no,
    p_coffee: d.coffee,
    p_food: d.food,
  })
  const lookup = [lookupQuery(formData), `branch=${d.branch}`].filter(Boolean).join('&')
  if (error) redirect(`${back}?${[lookup, `error=${errorKey(error.message)}`].filter(Boolean).join('&')}`)

  const row = Array.isArray(data) ? data[0] : data
  redirect(`${back}?${[lookup, `added=${row?.points_awarded ?? 0}`].filter(Boolean).join('&')}`)
}

export async function counterRedeemAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  await staffOrRedirect(locale)
  const back = `/${locale}/branch/points`

  const customer = z.guid().safeParse(formData.get('customer_id'))
  const branch = z.string().regex(SLUG).safeParse(formData.get('branch'))
  const points = z.coerce.number().int().positive().safeParse(formData.get('points'))
  if (!customer.success || !branch.success || !points.success) redirect(`${back}?error=input`)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('counter_redeem', {
    p_customer: customer.data,
    p_branch_slug: branch.data,
    p_points: points.data,
  })
  const lookup = [lookupQuery(formData), `branch=${branch.data}`].filter(Boolean).join('&')
  if (error) redirect(`${back}?${[lookup, `error=${errorKey(error.message)}`].filter(Boolean).join('&')}`)

  const row = Array.isArray(data) ? data[0] : data
  redirect(`${back}?${[lookup, `redeemed=${row?.discount_egp ?? 0}`].filter(Boolean).join('&')}`)
}
