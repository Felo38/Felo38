'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/errors'
import { siteOrigin } from './site'
import { normalizeEgyptPhone } from './phone'

const localeSchema = z.enum(['ar', 'en']).catch('ar')

// Step 1 of customer login: send an SMS code.
export async function requestOtpAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const phone = normalizeEgyptPhone(String(formData.get('phone') ?? ''))
  if (!phone) redirect(`/${locale}/login?error=phone`)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) redirect(`/${locale}/login?error=send`)

  const next = encodeURIComponent(safeNext(formData.get('next'), ''))
  redirect(`/${locale}/login?phone=${encodeURIComponent(phone)}${next ? `&next=${next}` : ''}`)
}

// Step 2 of customer login: verify the code and start a session.
export async function verifyOtpAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const phone = normalizeEgyptPhone(String(formData.get('phone') ?? ''))
  const token = String(formData.get('token') ?? '').trim()
  if (!phone) redirect(`/${locale}/login?error=phone`)
  if (!/^\d{6}$/.test(token)) redirect(`/${locale}/login?phone=${encodeURIComponent(phone)}&error=code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) redirect(`/${locale}/login?phone=${encodeURIComponent(phone)}&error=code`)

  redirect(safeNext(formData.get('next'), `/${locale}`))
}

// Branch staff and admins sign in with email and password.
export async function staffSignInAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1) })
    .safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) redirect(`/${locale}/staff/login?error=invalid`)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user) redirect(`/${locale}/staff/login?error=invalid`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profile?.role === 'admin') redirect(`/${locale}/admin`)
  if (profile?.role === 'branch_staff') redirect(`/${locale}/branch`)
  await supabase.auth.signOut()
  redirect(`/${locale}/staff/login?error=invalid`)
}

export async function signOutAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${locale}`)
}

// Google sign-in. The browser goes to Google, then comes back to /auth/callback.
export async function googleSignInAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const next = safeNext(formData.get('next'), `/${locale}`)
  const origin = await siteOrigin()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error || !data.url) redirect(`/${locale}/login?error=google`)
  redirect(data.url)
}

// Signed-in user without a phone: send an SMS code to verify the number.
export async function requestPhoneAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const phone = normalizeEgyptPhone(String(formData.get('phone') ?? ''))
  if (!phone) redirect(`/${locale}/account?error=phone`)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ phone })
  if (error) redirect(`/${locale}/account?error=send`)
  redirect(`/${locale}/account?phone=${encodeURIComponent(phone)}`)
}

// Checks the code. On success Auth saves the phone, and the database copies it to the profile.
export async function verifyPhoneAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const phone = normalizeEgyptPhone(String(formData.get('phone') ?? ''))
  const token = String(formData.get('token') ?? '').trim()
  if (!phone) redirect(`/${locale}/account?error=phone`)
  if (!/^\d{6}$/.test(token)) redirect(`/${locale}/account?phone=${encodeURIComponent(phone)}&error=code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })
  if (error) redirect(`/${locale}/account?phone=${encodeURIComponent(phone)}&error=code`)
  redirect(`/${locale}/account?verified=1`)
}

// Phone-first user adds Google to the same account.
export async function linkGoogleAction(formData: FormData) {
  const locale = localeSchema.parse(formData.get('locale'))
  const origin = await siteOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/account`)}` },
  })
  if (error || !data.url) redirect(`/${locale}/account?error=link`)
  redirect(data.url)
}
