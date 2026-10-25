import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

// Google (and other OAuth) return here with ?code=. Exchange it for a session, then go back to the page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'), `/${locale}`)

  if (!code) return NextResponse.redirect(new URL(`/${locale}/login?error=google`, url))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL(`/${locale}/login?error=google`, url))

  return NextResponse.redirect(new URL(next, url))
}
