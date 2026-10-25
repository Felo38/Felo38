import Link from 'next/link'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { BRANCH_COOKIE } from '@/lib/branch-cookie'
import { setDefaultBranchAction } from '@/lib/branch-preference'
import { listBranches } from '@/lib/catalog/queries'
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

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-extrabold text-brand">{t('title')}</h1>

        {saved && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {t('savedDefault')}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {t('errors.branch')}
          </p>
        )}

        {focused && focused.lat !== null && focused.lng !== null ? (
          <section aria-label={t('mapTitle')} className="overflow-hidden rounded-2xl border border-slate-200">
            <iframe
              title={t('mapTitle')}
              src={mapEmbedUrl(focused.lat, focused.lng)}
              className="h-64 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        ) : (
          focused && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{t('noCoordinates')}</p>
          )
        )}

        <ul className="space-y-4">
          {branches.map((b) => {
            const name = isAr ? b.name_ar : b.name_en
            const address = isAr ? b.address_ar : (b.address_en ?? b.address_ar)
            const isDefault = b.slug === savedSlug
            const directions = directionsUrl(b)
            const hours = b.working_hours?.text
            return (
              <li
                key={b.id}
                id={b.slug}
                className={`space-y-3 rounded-2xl border p-4 ${
                  b.slug === focused?.slug ? 'border-brand' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-brand">{name}</h2>
                  {isDefault && (
                    <span className="shrink-0 rounded-full bg-brand-accent px-2 py-0.5 text-xs font-bold text-brand">
                      {t('default')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{address}</p>
                <div className="text-sm text-slate-600">
                  <p>
                    <span className="font-semibold">{t('hours')}: </span>
                    {hours || t('noHours')}
                  </p>
                  {b.phone && (
                    <p dir="ltr" className="text-start">
                      <a href={`tel:${b.phone}`} className="underline">
                        {b.phone}
                      </a>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {directions && (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand"
                    >
                      {tc('directions')}
                    </a>
                  )}
                  <Link
                    href={`/${locale}/branches?branch=${b.slug}`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand"
                  >
                    {isAr ? 'اعرض على الخريطة' : 'Show on map'}
                  </Link>
                  {!isDefault && (
                    <form action={setDefaultBranchAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="slug" value={b.slug} />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
                      >
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
    </>
  )
}
