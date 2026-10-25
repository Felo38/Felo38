'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from './guard'

const localeSchema = z.enum(['ar', 'en']).catch('ar')

// Turns empty form strings into null, so optional DB columns stay clean.
const opt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

// Empty input stays null. Without this, z.coerce turns null into 0.
const optionalNumber = <T extends z.ZodNumber>(schema: T) =>
  z.preprocess((v) => (v === null || v === "" ? null : Number(v)), schema.nullable())

const productSchema = z.object({
  id: z.guid().optional(),
  category_id: z.guid(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug'),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description_ar: z.string().nullable(),
  description_en: z.string().nullable(),
  price_egp: z.coerce.number().nonnegative(),
  type: z.enum(['coffee', 'food', 'other']),
  sort_order: z.coerce.number().int(),
  active: z.boolean(),
})

export async function saveProductAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  await assertAdmin(locale)

  const parsed = productSchema.safeParse({
    id: opt(formData.get('id')) ?? undefined,
    category_id: formData.get('category_id'),
    slug: String(formData.get('slug') ?? '').trim().toLowerCase(),
    name_ar: String(formData.get('name_ar') ?? '').trim(),
    name_en: String(formData.get('name_en') ?? '').trim(),
    description_ar: opt(formData.get('description_ar')),
    description_en: opt(formData.get('description_en')),
    price_egp: formData.get('price_egp'),
    type: formData.get('type'),
    sort_order: formData.get('sort_order') ?? 0,
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) redirect(`/${locale}/admin/products?error=invalid`)

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('products').update(fields).eq('id', id)
    : await supabase.from('products').insert(fields)
  if (error) redirect(`/${locale}/admin/products?error=save`)

  revalidatePath(`/${locale}/menu`)
  revalidatePath(`/${locale}/admin/products`)
  redirect(`/${locale}/admin/products?saved=1`)
}

const branchSchema = z.object({
  id: z.guid().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug'),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  address_ar: z.string().min(1),
  address_en: z.string().nullable(),
  maps_url: z.url().nullable(),
  phone: z.string().nullable(),
  lat: optionalNumber(z.number().min(-90).max(90)),
  lng: optionalNumber(z.number().min(-180).max(180)),
  hours_text: z.string().nullable(),
  prep_minutes: z.coerce.number().int().nonnegative(),
  accepting_orders: z.boolean(),
  active: z.boolean(),
})

export async function saveBranchAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  await assertAdmin(locale)

  const latRaw = opt(formData.get('lat'))
  const lngRaw = opt(formData.get('lng'))
  // Coordinates come as a pair or not at all. The table has the same check.
  if ((latRaw === null) !== (lngRaw === null)) redirect(`/${locale}/admin/branches?error=coords`)

  const parsed = branchSchema.safeParse({
    id: opt(formData.get('id')) ?? undefined,
    slug: String(formData.get('slug') ?? '').trim().toLowerCase(),
    name_ar: String(formData.get('name_ar') ?? '').trim(),
    name_en: String(formData.get('name_en') ?? '').trim(),
    address_ar: String(formData.get('address_ar') ?? '').trim(),
    address_en: opt(formData.get('address_en')),
    maps_url: opt(formData.get('maps_url')),
    phone: opt(formData.get('phone')),
    lat: latRaw,
    lng: lngRaw,
    hours_text: opt(formData.get('hours_text')),
    prep_minutes: formData.get('prep_minutes') ?? 15,
    accepting_orders: formData.get('accepting_orders') === 'on',
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) redirect(`/${locale}/admin/branches?error=invalid`)

  const d = parsed.data
  const fields = {
    slug: d.slug,
    name_ar: d.name_ar,
    name_en: d.name_en,
    address_ar: d.address_ar,
    address_en: d.address_en,
    maps_url: d.maps_url,
    phone: d.phone,
    lat: d.lat,
    lng: d.lng,
    working_hours: { text: d.hours_text ?? '' },
    prep_minutes: d.prep_minutes,
    accepting_orders: d.accepting_orders,
    active: d.active,
  }

  const supabase = await createClient()
  const { error } = d.id
    ? await supabase.from('branches').update(fields).eq('id', d.id)
    : await supabase.from('branches').insert(fields)
  if (error) redirect(`/${locale}/admin/branches?error=save`)

  revalidatePath(`/${locale}/branches`)
  revalidatePath(`/${locale}/menu`)
  redirect(`/${locale}/admin/branches?saved=1`)
}

// The form sends every branch|product pair as "pair", and the checked ones as "available".
export async function saveAvailabilityAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const profile = await assertAdmin(locale)

  const pairs = formData.getAll('pair').map(String)
  const on = new Set(formData.getAll('available').map(String))
  const rows = pairs.map((key) => {
    const [branch_id, product_id] = key.split('|')
    return { branch_id, product_id, available: on.has(key), updated_by: profile.id, updated_at: new Date().toISOString() }
  })

  const supabase = await createClient()
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('branch_products')
      .upsert(rows.slice(i, i + 200), { onConflict: 'branch_id,product_id' })
    if (error) redirect(`/${locale}/admin/availability?error=save`)
  }

  revalidatePath(`/${locale}/menu`)
  redirect(`/${locale}/admin/availability?saved=1`)
}
