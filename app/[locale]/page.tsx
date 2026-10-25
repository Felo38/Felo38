import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="rounded-2xl bg-brand-accent p-6 text-center">
        <h1 className="text-2xl font-extrabold text-brand">{t('title')}</h1>
        <p className="mt-2 text-sm text-brand/80">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`/${locale}/menu`} className="rounded-xl bg-brand px-4 py-4 text-center font-semibold text-white">
          {t('menu')}
        </Link>
        <Link href={`/${locale}/branches`} className="rounded-xl bg-brand px-4 py-4 text-center font-semibold text-white">
          {t('branches')}
        </Link>
      </div>
      <div className="flex flex-col gap-3 pt-4 text-sm">
        <Link href={`/${locale}/login`} className="text-center font-semibold text-brand underline">
          {t('customerLogin')}
        </Link>
        <Link href={`/${locale}/staff/login`} className="text-center font-semibold text-brand underline">
          {t('staffLogin')}
        </Link>
      </div>
    </main>
  )
}
