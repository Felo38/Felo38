import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { OrderTracker } from '@/components/customer/order-tracker'
import { cancelOrderAction } from '@/lib/orders/actions'
import { createClient } from '@/lib/supabase/server'
import { getNavLabels } from '@/lib/customer/nav'
import { CUSTOMER_CANCELLABLE, type OrderStatus } from '@/lib/orders/status'

const ORDER_ERRORS = ['move', 'forbidden']
const TIMELINE: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'picked_up']

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ placed?: string; cancelled?: string; error?: string }>
}) {
  const { locale, id } = await params
  const { placed, cancelled, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('orders')
  const ts = await getTranslations('status')
  const te = await getTranslations('errors')
  const isAr = locale === 'ar'

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(product_name_ar, product_name_en, quantity, line_total_egp), order_status_events(to_status, created_at)')
    .eq('id', id)
    .maybeSingle()
  if (!order) notFound()

  const status = order.status as OrderStatus
  const events = [...(order.order_status_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const step = TIMELINE.indexOf(status)
  const cancellable = CUSTOMER_CANCELLABLE.includes(status)
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <OrderTracker orderId={order.id} placed={placed === '1'} />
      <Hero title={`#${order.order_no}`} />
      <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-5">
        {placed === '1' && <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-700">{t('placed')}</p>}
        {cancelled === '1' && <p role="status" className="rounded-2xl bg-slate-100 p-4 font-semibold">{t('cancelledDone')}</p>}
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{te(ORDER_ERRORS.includes(error) ? error : 'generic')}</p>}

        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-lg font-extrabold text-brand">{ts(status)}</p>
          {status === 'rescheduled' && order.ready_at && (
            <p className="text-sm font-semibold text-slate-700">{t('readyOn')}: {when(order.ready_at)}</p>
          )}
          {(status === 'rejected' || status === 'cancelled') && order.status_reason && (
            <p className="text-sm text-slate-600">{t('reasonLabel')}: {order.status_reason}</p>
          )}
          {order.requires_confirmation && status === 'pending' && (
            <p className="text-sm text-amber-700">{t('requiresConfirmation')}</p>
          )}
          {status !== 'rejected' && status !== 'cancelled' && (
            <ol className="mt-4 space-y-3">
              {TIMELINE.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className={`size-3 rounded-full ${i <= step ? 'bg-brand' : 'bg-slate-200'}`} />
                  <span className={`text-sm ${i <= step ? 'font-bold text-brand' : 'text-slate-400'}`}>{ts(s)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-brand">{t('items')}</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {(order.order_items ?? []).map((it: { quantity: number; product_name_ar: string; product_name_en: string; line_total_egp: number }, i: number) => (
              <li key={i} className="flex justify-between py-2">
                <span>{it.quantity} × {isAr ? it.product_name_ar : it.product_name_en}</span>
                <span className="font-semibold">{Number(it.line_total_egp).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            <p className="flex justify-between"><span>{t('subtotal')}</span><span>{Number(order.subtotal_egp).toFixed(2)}</span></p>
            {Number(order.discount_egp) > 0 && (
              <p className="flex justify-between"><span>{t('discount')}</span><span>−{Number(order.discount_egp).toFixed(2)}</span></p>
            )}
            <p className="flex justify-between text-base font-extrabold text-brand"><span>{t('total')}</span><span>{Number(order.total_egp).toFixed(2)}</span></p>
          </div>
        </section>

        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm text-sm">
          <h2 className="font-extrabold text-brand">{t('history')}</h2>
          <ul className="space-y-1 text-slate-600">
            {events.map((e, i) => (
              <li key={i}>{ts(e.to_status)} · {when(e.created_at)}</li>
            ))}
          </ul>
        </section>

        {cancellable && (
          <form action={cancelOrderAction} className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="order_id" value={order.id} />
            <input name="reason" placeholder={t('cancelReason')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <button type="submit" className="w-full rounded-2xl border border-brand-red py-3 font-bold text-brand-red">
              {t('cancelOrder')}
            </button>
          </form>
        )}

        <Link href={`/${locale}/orders`} className="block text-center text-sm font-semibold text-brand underline">{t('back')}</Link>
      </main>
      <BottomNav locale={locale} labels={await getNavLabels()} />
    </>
  )
}
