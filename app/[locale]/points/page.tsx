import QRCode from 'qrcode'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { getCurrentProfile } from '@/lib/auth/session'
import { getBalance, getCurrentRules, getLedger } from '@/lib/loyalty/queries'
import { getNavLabels } from '@/lib/customer/nav'
import { createClient } from '@/lib/supabase/server'

export default async function PointsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('points')
  const profile = await getCurrentProfile()

  if (!profile) {
    return (
      <>
        <Hero title={t('title')} />
        <main className="mx-auto max-w-md px-5 pb-28 pt-5">
          <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/points`)}`} className="block rounded-2xl bg-brand py-4 text-center font-bold text-white">
            {t('signIn')}
          </Link>
        </main>
        <BottomNav locale={locale} labels={await getNavLabels()} />
      </>
    )
  }

  const [balance, rules, ledger] = await Promise.all([getBalance(), getCurrentRules(), getLedger()])
  // The QR encodes a random token, never the phone number. Staff scan it at the counter.
  const supabase = await createClient()
  const { data: me } = await supabase.from('profiles').select('qr_token').eq('id', profile.id).single()
  const qrSvg = await QRCode.toString(me?.qr_token ?? '', { type: 'svg', margin: 1 })
  const typeLabel = (type: string) => t(`type_${type}`)

  return (
    <>
      <Hero title={t('title')}>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-xs text-white/70">{t('balance')}</p>
          <p className="text-4xl font-extrabold">{balance} <span className="text-base font-semibold">{t('points')}</span></p>
        </div>
      </Hero>
      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        <section className="space-y-3 rounded-3xl bg-white p-5 text-center shadow-sm">
          <p className="font-extrabold text-brand">{t('qrTitle')}</p>
          <div className="mx-auto w-56 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="text-xs text-slate-500">{t('qrHint')}</p>
        </section>

        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm text-sm">
          <h2 className="font-extrabold text-brand">{t('howTitle')}</h2>
          <p>{t('howCoffee', { rate: String(rules.coffee_points_per_egp) })}</p>
          <p>{t('howFood', { rate: String(rules.food_points_per_egp) })}</p>
          <p>{t('howRedeem', { value: String(rules.redeem_egp_per_point), min: String(rules.min_redeem_points) })}</p>
          <p className="text-slate-500">{t('howPickup')}</p>
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-brand">{t('history')}</h2>
          {ledger.length === 0 && <p className="text-sm text-slate-500">{t('empty')}</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {ledger.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">{typeLabel(row.type)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString(locale, { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className={`font-extrabold ${row.delta > 0 ? 'text-emerald-700' : 'text-brand-red'}`}>
                  {row.delta > 0 ? '+' : ''}{row.delta}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-center text-xs text-slate-400">{t('footnote')}</p>
      </main>
      <BottomNav locale={locale} labels={await getNavLabels()} />
    </>
  )
}

