import Link from 'next/link'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'
import { listBranches } from '@/lib/catalog/queries'
import { getNavLabels } from '@/lib/customer/nav'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')
  const tc = await getTranslations('common')
  const isAr = locale === 'ar'

  const branches = await listBranches()
  const savedSlug = (await cookies()).get(BRANCH_COOKIE)?.value
  const store = branches.find((b) => b.slug === savedSlug) ?? branches[0]
  const navLabels = await getNavLabels()

  return (
    <>
      <Hero title={t('title')}>
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/70">{t('points')}</p>
            <p className="mt-1 text-2xl font-extrabold">—</p>
            <p className="text-xs text-white/70">{t('pointsHint')}</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/70">{t('rewards')}</p>
            <p className="mt-1 text-2xl font-extrabold">—</p>
            <p className="text-xs text-white/70">{t('rewardsHint')}</p>
          </div>
        </div>
      </Hero>

      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        {store && (
          <section className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand">{t('yourStore')}</p>
              <p className="truncate font-bold">{isAr ? store.name_ar : store.name_en}</p>
              <p className="truncate text-sm text-slate-500">{isAr ? store.address_ar : (store.address_en ?? store.address_ar)}</p>
            </div>
            <Link href={`/${locale}/branches?branch=${store.slug}`} className="shrink-0 text-sm font-bold text-brand underline">
              {tc('storeInfo')}
            </Link>
          </section>
        )}

        <section className="overflow-hidden rounded-3xl bg-brand-accent p-6 text-center shadow-sm">
          <p className="text-2xl font-extrabold italic text-brand">On the Run</p>
          <p className="mt-1 text-sm font-extrabold uppercase tracking-widest text-brand-red">Rewards</p>
          <p className="mt-3 text-sm font-semibold text-brand/90">{t('rewardsBanner')}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link href={`/${locale}/menu`} className="rounded-2xl bg-white p-5 font-bold text-brand shadow-sm">
            {navLabels.menu}
          </Link>
          <Link href={`/${locale}/branches`} className="rounded-2xl bg-white p-5 font-bold text-brand shadow-sm">
            {navLabels.branches}
          </Link>
        </section>
      </main>

      <BottomNav locale={locale} labels={navLabels} />
    </>
  )
}
