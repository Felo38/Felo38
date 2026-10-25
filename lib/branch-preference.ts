'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'

// Saves the default branch in a cookie for everyone, and on the profile for signed-in customers.
export async function setDefaultBranchAction(formData: FormData) {
  const locale = z.enum(['ar', 'en']).catch('ar').parse(formData.get('locale'))
  const slug = z.string().regex(/^[a-z0-9-]+$/).safeParse(formData.get('slug'))
  if (!slug.success) redirect(`/${locale}/branches?error=branch`)

  const supabase = await createClient()
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('slug', slug.data)
    .eq('active', true)
    .maybeSingle()
  if (!branch) redirect(`/${locale}/branches?error=branch`)

  const jar = await cookies()
  jar.set(BRANCH_COOKIE, slug.data, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ default_branch_id: branch.id }).eq('id', user.id)
  }

  redirect(`/${locale}/branches?branch=${slug.data}&saved=1`)
}
