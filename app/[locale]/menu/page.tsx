import Link from 'next/link'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'
import { listBranchProducts, listBranches, listCategories, listProducts } from '@/lib/catalog/queries'
import { getNavLabels } from '@/lib/customer/nav'
import { AddToCartButton } from '@/components/customer/add-to-cart'
import { pick } from '@/lib/i18n/pick'

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
    branches.find((b) => b.slug === branch) ?? branches.find((b) => b.slug === savedSlug) ?? branches[0]

  const availableIds = new Set(
    branchProducts.filter((bp) => bp.branch_id === selected?.id && bp.available).map((bp) => bp.product_id),
  )

  const needle = (q ?? '').trim().toLowerCase()
  const activeCat = categories.find((c) => c.slug === cat) ?? categories[0]
  const visible = products.filter((p) => {
    if (needle) return [p.name_ar, p.name_en].some((n) => n.toLowerCase().includes(needle))
    return p.category_id === activeCat?.id
  })
  const branchParam = selected ? `branch=${selected.slug}` : ''
  const navLabels = await getNavLabels()
  const cartLabels = pick((k) => t(k), ['addToCart', 'switchBranch'])

  return (
    <>
      <Hero title={t('title')}>
        {selected ? (
          <Link
            href={`/${locale}/branches?branch=${selected.slug}`}
            className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-xs text-white/70">{t('branchLabel')}</span>
              <span className="block truncate font-bold">{isAr ? selected.name_ar : selected.name_en}</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-brand-accent">{t('change')}</span>
          </Link>
        ) : (
          <p className="text-white/80">{t('noBranches')}</p>
        )}

        <form action={`/${locale}/menu`} className="mt-4">
          {selected && <input type="hidden" name="branch" value={selected.slug} />}
          {activeCat && !needle && <input type="hidden" name="cat" value={activeCat.slug} />}
          <input
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full rounded-full bg-white px-5 py-3 text-slate-900 placeholder:text-slate-400"
          />
        </form>
      </Hero>

      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        {!needle && (
          <nav aria-label={t('title')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/${locale}/menu?${branchParam}&cat=${c.slug}`}
                aria-current={c.id === activeCat?.id ? 'true' : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                  c.id === activeCat?.id ? 'bg-brand text-white' : 'bg-white text-brand shadow-sm'
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
            <Link href={`/${locale}/menu?${branchParam}`} className="font-semibold text-brand underline">
              {t('clearSearch')}
            </Link>
          </p>
        )}

        <ul className="space-y-3">
          {visible.map((p) => {
            const isAvailable = availableIds.has(p.id)
            const description = isAr ? p.description_ar : p.description_en
            return (
              <li
                key={p.id}
                className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ${isAvailable ? '' : 'opacity-60'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{isAr ? p.name_ar : p.name_en}</p>
                  {description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{description}</p>}
                  <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${isAvailable ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className={`size-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {isAvailable ? t('available') : t('unavailable')}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="rounded-full bg-brand px-3 py-1.5 text-sm font-extrabold text-white">
                    {p.price_egp} {tc('currency')}
                  </p>
                  {selected && isAvailable && (
                    <AddToCartButton
                      productId={p.id}
                      branchSlug={selected.slug}
                      label={cartLabels.addToCart}
                      switchBranchMessage={cartLabels.switchBranch}
                      itemName={isAr ? p.name_ar : p.name_en}
                    />
                  )}
                </div>
              </li>
            )
          })}
          {visible.length === 0 && (
            <li className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
              {needle ? t('noResults') : t('noItems')}
            </li>
          )}
        </ul>

        <p className="text-center text-xs text-slate-500">{t('branchUnavailableNote')}</p>
      </main>

      <BottomNav locale={locale} labels={navLabels} />
    </>
  )
}
