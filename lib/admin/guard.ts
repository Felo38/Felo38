import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/session'

// Every admin action calls this first. RLS is the real guard. This gives a clear redirect.
export async function assertAdmin(locale: string) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') redirect(`/${locale}/staff/login`)
  return profile
}
