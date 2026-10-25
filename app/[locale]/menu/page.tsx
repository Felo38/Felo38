import Link from 'next/link'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'
import { listBranchProducts, listBranches, listCategories, listProducts } from '@/lib/catalog/queries'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string; cat?: string; q?: string }>
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { branch, cat, q } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('menu')
  const tc = await getTranslations('common')
  const isAr = locale === 'ar'

  const [branches, categories, products, branchProducts] = await Promise.all([
    listBranches(),
    listCategories(),
    listProducts(),
    listBranchProducts(),
  ])

  const savedSlug = (await cookies()).get(BRANCH_COOKIE)?.value
  const selected =
    branches.find((b) => b.slug === branch) ??
    branches.find((b) => b.slug === savedSlug) ??
    branches[0]

  const availableIds = new Set(
    branchProducts.filter((bp) => bp.branch_id === selected?.id && bp.available).map((bp) => bp.product_id),
  )

  const needle = (q ?? '').trim().toLowerCase()
  const activeCat = categories.find((c) => c.slug === cat) ?? categories[0]
  const visible = products.filter((p) => {
    if (needle) {
      return [p.name_ar, p.name_en].some((n) => n.toLowerCase().includes(needle))
    }
    return p.category_id === activeCat?.id
  })
  const branchParam = selected ? `branch=${selected.slug}` : ''

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-extrabold text-brand">{t('title')}</h1>

        {branches.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-slate-600">{t('noBranches')}</p>
        ) : (
          <>
            <section aria-label={t('branchLabel')} className="space-y-2">
              <p className="text-sm font-semibold text-slate-600">{t('branchLabel')}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {branches.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${locale}/menu?branch=${b.slug}`}
                    aria-current={b.id === selected?.id ? 'true' : undefined}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                      b.id === selected?.id
                        ? 'bg-brand text-white'
                        : 'bg-brand-accent/40 text-brand'
                    }`}
                  >
                    {isAr ? b.name_ar : b.name_en}
                  </Link>
                ))}
              </div>
            </section>

            <form action={`/${locale}/menu`} className="flex gap-2">
              {selected && <input type="hidden" name="branch" value={selected.slug} />}
              {activeCat && !needle && <input type="hidden" name="cat" value={activeCat.slug} />}
              <input
                name="q"
                type="search"
                defaultValue={q ?? ''}
                placeholder={t('search')}
                aria-label={t('search')}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3"
              />
              <button type="submit" className="rounded-xl bg-brand px-4 font-semibold text-white">
                {t('searchButton')}
              </button>
            </form>

            {!needle && (
              <nav aria-label={t('title')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/${locale}/menu?${branchParam}&cat=${c.slug}`}
                    aria-current={c.id === activeCat?.id ? 'true' : undefined}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                      c.id === activeCat?.id
                        ? 'border-brand bg-brand text-white'
                        : 'border-slate-300 text-brand'
                    }`}
                  >
                    {isAr ? c.name_ar : c.name_en}
                  </Link>
                ))}
              </nav>
            )}

            {needle && (
              <p className="text-sm text-slate-600">
                {t('searchResults')}: <strong>{q}</strong> ·{' '}
                <Link href={`/${locale}/menu?${branchParam}`} className="underline">
                  {t('clearSearch')}
                </Link>
              </p>
            )}

            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
              {visible.map((p) => {
                const isAvailable = availableIds.has(p.id)
                return (
                  <li key={p.id} className={`flex gap-4 p-4 ${isAvailable ? '' : 'opacity-60'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{isAr ? p.name_ar : p.name_en}</p>
                      {(isAr ? p.description_ar : p.description_en) && (
                        <p className="mt-1 text-sm text-slate-600">
                          {isAr ? p.description_ar : p.description_en}
                        </p>
                      )}
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isAvailable ? t('available') : t('unavailable')}
                      </span>
                    </div>
                    <p className="shrink-0 font-bold text-brand">
                      {p.price_egp} {tc('currency')}
                    </p>
                  </li>
                )
              })}
              {visible.length === 0 && (
                <li className="p-6 text-center text-slate-500">{needle ? t('noResults') : t('noItems')}</li>
              )}
            </ul>

            <p className="text-xs text-slate-500">{t('branchUnavailableNote')}</p>
          </>
        )}
      </main>
    </>
  )
}
