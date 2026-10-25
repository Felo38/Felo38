import { requireRole } from '@/lib/auth/session'
import { signOutAction } from '@/lib/auth/actions'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireRole(locale, ['admin'], '/staff/login')

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="font-semibold text-brand">Admin</span>
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-sm text-brand underline">
            {locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        </form>
      </header>
      {children}
    </div>
  )
}
