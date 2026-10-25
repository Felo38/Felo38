import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { PushToggle } from '@/components/customer/push-toggle'
import { markNotificationsReadAction } from '@/lib/orders/actions'
import { listBranches } from '@/lib/catalog/queries'
import { createClient } from '@/lib/supabase/server'
import { getNavLabels } from '@/lib/customer/nav'
import { getCurrentProfile } from '@/lib/auth/session'

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('orders')
  const ts = await getTranslations('status')
  const isAr = locale === 'ar'

  const profile = await getCurrentProfile()
  if (!profile) {
    return (
      <>
        <Hero title={t('title')} />
        <main className="mx-auto max-w-md px-5 pb-28 pt-5">
          <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/orders`)}`} className="block rounded-2xl bg-brand py-4 text-center font-bold text-white">
            {t('signIn')}
          </Link>
        </main>
        <BottomNav locale={locale} labels={await getNavLabels()} />
      </>
    )
  }

  const supabase = await createClient()
  const [{ data: orders }, { data: notes }, branches] = await Promise.all([
    supabase.from('orders').select('id, order_no, status, type, total_egp, created_at, branch_id').order('created_at', { ascending: false }).limit(30),
    supabase.from('notifications').select('id, title_ar, title_en, body_ar, body_en, read_at, created_at').order('created_at', { ascending: false }).limit(10),
    listBranches({ includeInactive: true }),
  ])
  const branchName = new Map(branches.map((b) => [b.id, isAr ? b.name_ar : b.name_en]))
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  return (
    <>
      <Hero title={t('title')} />
      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        <section className="space-y-3">
          <h2 className="font-extrabold text-brand">{t('myOrders')}</h2>
          {(orders ?? []).length === 0 && <p className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">{t('empty')}</p>}
          <ul className="space-y-3">
            {(orders ?? []).map((o) => (
              <li key={o.id}>
                <Link href={`/${locale}/orders/${o.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                  <div>
                    <p className="font-bold">#{o.order_no} · {branchName.get(o.branch_id) ?? ''}</p>
                    <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString(locale, { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div className="text-end">
                    <span className="rounded-full bg-brand-accent/40 px-2.5 py-1 text-xs font-bold text-brand">{ts(o.status)}</span>
                    <p className="mt-1 text-sm font-bold">{Number(o.total_egp).toFixed(2)} {isAr ? 'ج.م' : 'EGP'}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-brand">{t('notifications')}</h2>
            {(notes ?? []).some((n) => !n.read_at) && (
              <form action={markNotificationsReadAction}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="text-xs font-bold text-brand underline">{t('markRead')}</button>
              </form>
            )}
          </div>
          {(notes ?? []).length === 0 && <p className="text-sm text-slate-500">{t('noNotifications')}</p>}
          <ul className="divide-y divide-slate-100">
            {(notes ?? []).map((n) => (
              <li key={n.id} className={`py-3 ${n.read_at ? 'opacity-60' : ''}`}>
                <p className="font-semibold">{isAr ? n.title_ar : n.title_en}</p>
                <p className="text-sm text-slate-600">{isAr ? n.body_ar : n.body_en}</p>
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <PushToggle
              vapidPublicKey={vapid}
              labels={{
                enable: t('pushEnable'),
                enabled: t('pushEnabled'),
                unsupported: t('pushUnsupported'),
                denied: t('pushDenied'),
                failed: t('pushFailed'),
              }}
            />
          </div>
        </section>
      </main>
      <BottomNav locale={locale} labels={await getNavLabels()} />
    </>
  )
}
