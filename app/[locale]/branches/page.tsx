import Link from 'next/link'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'
import { listBranches } from '@/lib/catalog/queries'
import { setDefaultBranchAction } from '@/lib/branch-preference'
import { getNavLabels } from '@/lib/customer/nav'
import type { Branch } from '@/lib/catalog/types'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string; saved?: string; error?: string }>
}

// OpenStreetMap embed. No API key, no client JS.
function mapEmbedUrl(lat: number, lng: number) {
  const d = 0.008
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function directionsUrl(b: Branch) {
  if (b.maps_url) return b.maps_url
  if (b.lat !== null && b.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`
  }
  return null
}

export default async function BranchesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { branch, saved, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('branches')
  const tc = await getTranslations('common')
  const isAr = locale === 'ar'

  const branches = await listBranches()
  const savedSlug = (await cookies()).get(BRANCH_COOKIE)?.value
  const focused = branches.find((b) => b.slug === branch) ?? branches.find((b) => b.slug === savedSlug)
  const navLabels = await getNavLabels()

  return (
    <>
      <Hero title={t('title')} />

      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        {saved && (
          <p role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {t('savedDefault')}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            {t('errors.branch')}
          </p>
        )}

        {focused && focused.lat !== null && focused.lng !== null ? (
          <section aria-label={t('mapTitle')} className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <iframe
              title={t('mapTitle')}
              src={mapEmbedUrl(focused.lat, focused.lng)}
              className="h-56 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        ) : (
          focused && (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">{t('noCoordinates')}</p>
          )
        )}

        <ul className="space-y-4">
          {branches.map((b) => {
            const name = isAr ? b.name_ar : b.name_en
            const address = isAr ? b.address_ar : (b.address_en ?? b.address_ar)
            const isDefault = b.slug === savedSlug
            const directions = directionsUrl(b)
            const hours = b.working_hours?.text
            const isFocused = b.slug === focused?.slug
            return (
              <li
                key={b.id}
                id={b.slug}
                className={`space-y-3 rounded-3xl bg-white p-5 shadow-sm ${isFocused ? 'ring-2 ring-brand' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-brand">{name}</h2>
                  {isDefault && (
                    <span className="shrink-0 rounded-full bg-brand-accent px-2.5 py-1 text-xs font-extrabold text-brand">
                      {t('default')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{address}</p>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{t('hours')}: </span>
                  {hours || t('noHours')}
                </p>
                {b.phone && (
                  <p dir="ltr" className="text-start text-sm">
                    <a href={`tel:${b.phone}`} className="font-semibold text-brand underline">
                      {b.phone}
                    </a>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white"
                    >
                      {tc('directions')}
                    </a>
                  )}
                  <Link
                    href={`/${locale}/branches?branch=${b.slug}`}
                    className="rounded-full border border-brand px-4 py-2 text-sm font-bold text-brand"
                  >
                    {t('showOnMap')}
                  </Link>
                  {!isDefault && (
                    <form action={setDefaultBranchAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="slug" value={b.slug} />
                      <button type="submit" className="rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-brand">
                        {t('setDefault')}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </main>

      <BottomNav locale={locale} labels={navLabels} />
    </>
  )
}
