import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { getEnv } from '@/lib/env'

const handleI18n = createIntlMiddleware(routing)

// Protected areas. Real access control is RLS and server checks. This only avoids showing empty pages.
const PROTECTED = /^\/(ar|en)\/(admin|branch)(\/|$)/

export async function proxy(request: NextRequest) {
  const response = handleI18n(request)
  // Locale redirects (for example, /menu -> /ar/menu) go straight back to the browser.
  if (response.status >= 300 && response.status < 400) return response

  const env = getEnv()
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Refreshes the session cookie on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const match = PROTECTED.exec(request.nextUrl.pathname)
  if (!match) return response

  const locale = match[1]
  const area = match[2]
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!user) return redirectTo(`/${locale}/staff/login`)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = area === 'admin' ? ['admin'] : ['admin', 'branch_staff']
  if (!profile || !allowed.includes(profile.role)) return redirectTo(`/${locale}`)

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
