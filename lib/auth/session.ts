import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const profileSchema = z.object({
  id: z.uuid(),
  role: z.enum(['customer', 'branch_staff', 'admin']),
  branch_id: z.uuid().nullable(),
  phone: z.string().nullable(),
  full_name: z.string().nullable(),
  locale: z.enum(['ar', 'en']),
})

export type Profile = z.infer<typeof profileSchema>
export type Role = Profile['role']

// Returns the signed-in user's profile, or null. Validates the JWT with Supabase Auth.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, branch_id, phone, full_name, locale')
    .eq('id', user.id)
    .single()
  if (error || !data) return null

  return profileSchema.parse(data)
}

// Defense in depth: proxy.ts already redirects, but every protected layout checks again.
export async function requireRole(locale: string, allowed: Role[], loginPath: string) {
  const profile = await getCurrentProfile()
  if (!profile) redirect(`/${locale}${loginPath}`)
  if (!allowed.includes(profile.role)) redirect(`/${locale}`)
  return profile
}
