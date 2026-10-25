import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations('common')
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href={`/${locale}`} className="font-extrabold text-brand">
          {t('appName')}
        </Link>
        <nav className="flex gap-4 text-sm font-semibold text-brand">
          <Link href={`/${locale}/menu`}>{locale === 'ar' ? 'المنيو' : 'Menu'}</Link>
          <Link href={`/${locale}/branches`}>{locale === 'ar' ? 'الفروع' : 'Branches'}</Link>
        </nav>
      </div>
    </header>
  )
}
