import { getTranslations, setRequestLocale } from 'next-intl/server'

export default async function BranchHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('branch')

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
      <p className="mt-2 text-slate-600">{t('comingSoon')}</p>
    </main>
  )
}
