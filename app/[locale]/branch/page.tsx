import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LiveRefresh } from '@/components/branch/live-refresh'
import { getCurrentProfile } from '@/lib/auth/session'
import { setStockAction, transitionOrderAction } from '@/lib/branch/actions'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_STATUSES, STAFF_MOVES, type OrderStatus } from '@/lib/orders/status'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string; updated?: string; error?: string }>
}

const ERROR_KEYS = ['move', 'time', 'reason', 'forbidden', 'input', 'generic', 'unavailable', 'points', 'minRedeem', 'signin', 'cart', 'duplicate']

export default async function BranchDashboard({ params, searchParams }: Props) {
  const { locale } = await params
  const { branch: branchParam, updated, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('branch')
  const ta = await getTranslations('actions')
  const ts = await getTranslations('status')
  const te = await getTranslations('errors')
  const isAr = locale === 'ar'

  const profile = await getCurrentProfile()
  if (!profile) redirect(`/${locale}/staff/login`)

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, slug, name_ar, name_en, accepting_orders')
    .order('name_en')
  const list = branches ?? []
  // Staff are tied to one branch. Admins pick one with ?branch=slug.
  const branch = profile.branch_id ? list.find((b) => b.id === profile.branch_id) : list.find((b) => b.slug === branchParam)
  const branchName = (b: { name_ar: string; name_en: string }) => (isAr ? b.name_ar : b.name_en)

  if (!branch) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <h1 className="text-xl font-bold text-brand">{t('chooseBranch')}</h1>
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/${locale}/branch?branch=${b.slug}`} className="block rounded-xl border border-slate-200 p-3 font-semibold text-brand">
                {branchName(b)}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  const back = `/${locale}/branch${profile.role === 'admin' ? `?branch=${branch.slug}` : ''}`
  const [{ data: orders }, { data: products }, { data: stock }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_no, status, type, scheduled_for, ready_at, requires_confirmation, customer_name, customer_phone, total_egp, created_at, order_items(product_name_ar, product_name_en, quantity)')
      .eq('branch_id', branch.id)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: true }),
    supabase.from('products').select('id, name_ar, name_en').eq('active', true).order('sort_order'),
    supabase.from('branch_products').select('product_id, available').eq('branch_id', branch.id),
  ])
  const offered = new Set((stock ?? []).filter((s) => s.available).map((s) => s.product_id))
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { timeZone: 'Africa/Cairo', dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <LiveRefresh
        branchId={branch.id}
        labels={{ live: t('live'), soundOn: t('soundOn'), soundOff: t('soundOff'), enableSound: t('enableSound') }}
      />

      {updated && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{t('updated')}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{te(ERROR_KEYS.includes(error) ? error : 'generic')}</p>}

      <section className="space-y-3">
        <h1 className="text-xl font-extrabold text-brand">{branchName(branch)}</h1>
        <h2 className="font-bold">{t('openOrders')} ({(orders ?? []).length})</h2>
        {(orders ?? []).length === 0 && <p className="rounded-xl bg-white p-4 text-slate-500 shadow-sm">{t('noOrders')}</p>}

        <ul className="space-y-4">
          {(orders ?? []).map((o) => {
            const status = o.status as OrderStatus
            const moves = STAFF_MOVES[status]
            const items = (o.order_items ?? []).map((it: { quantity: number; product_name_ar: string; product_name_en: string }) =>
              `${it.quantity} × ${isAr ? it.product_name_ar : it.product_name_en}`,
            )
            return (
              <li key={o.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-brand">#{o.order_no} · {ts(status)}</p>
                    <p className="text-sm font-semibold">{o.customer_name ?? '—'}
                      {o.customer_phone && <> · <a dir="ltr" href={`tel:${o.customer_phone}`} className="underline">{o.customer_phone}</a></>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(`type_${o.type}`)}
                      {o.scheduled_for && ` · ${when(o.scheduled_for)}`}
                      {o.ready_at && ` · ${t('readyAt')} ${when(o.ready_at)}`}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{Number(o.total_egp).toFixed(2)}</p>
                </div>
                <p className="text-sm text-slate-700">{items.join(' · ')}</p>
                {o.requires_confirmation && status === 'pending' && (
                  <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">{t('largeOrder')}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {moves.map((to) => {
                    if (to === 'rejected') {
                      return (
                        <form key={to} action={transitionOrderAction} className="flex w-full flex-wrap gap-2">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="to" value="rejected" />
                          <input name="reason" required placeholder={t('reasonPlaceholder')} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <button type="submit" className="rounded-xl border border-brand-red px-4 py-2 text-sm font-bold text-brand-red">{ta('rejected')}</button>
                        </form>
                      )
                    }
                    if (to === 'rescheduled') {
                      return (
                        <form key={to} action={transitionOrderAction} className="flex w-full flex-wrap gap-2">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="to" value="rescheduled" />
                          <input type="datetime-local" name="ready_local" required dir="ltr" aria-label={t('readyAt')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <button type="submit" className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-brand">{ta('rescheduled')}</button>
                        </form>
                      )
                    }
                    return (
                      <form key={to} action={transitionOrderAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="to" value={to} />
                        <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">{ta(to)}</button>
                      </form>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t('stock')}</h2>
        <p className="text-sm text-slate-500">{t('stockHelp')}</p>
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm">
          {(products ?? []).map((p) => {
            const on = offered.has(p.id)
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <span className={`font-semibold ${on ? '' : 'text-slate-400 line-through'}`}>{isAr ? p.name_ar : p.name_en}</span>
                <form action={setStockAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="product_id" value={p.id} />
                  {!on && <input type="hidden" name="available" value="on" />}
                  <button type="submit" className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {on ? t('inStock') : t('outOfStock')}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      </section>

      <Link href={`/${locale}/branch/points${profile.role === 'admin' ? `?branch=${branch.slug}` : ''}`} className="block rounded-2xl bg-brand py-4 text-center font-bold text-white">
        {t('pointsDesk')}
      </Link>
    </div>
  )
}
