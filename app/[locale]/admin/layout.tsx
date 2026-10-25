import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
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
  const t = await getTranslations('admin')
  const tc = await getTranslations('common')

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${locale}/admin`} className="font-extrabold text-brand">
            {t('title')}
          </Link>
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-sm text-brand underline">
              {tc('signOut')}
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3 text-sm font-semibold">
          <Link href={`/${locale}/admin/products`} className="rounded-lg bg-slate-100 px-3 py-2 text-brand">
            {t('nav.products')}
          </Link>
          <Link href={`/${locale}/admin/branches`} className="rounded-lg bg-slate-100 px-3 py-2 text-brand">
            {t('nav.branches')}
          </Link>
          <Link href={`/${locale}/admin/availability`} className="rounded-lg bg-slate-100 px-3 py-2 text-brand">
            {t('nav.availability')}
          </Link>
        </nav>
      </header>
      {children}
    </div>
  )
}
