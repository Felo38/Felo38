import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { addReceiptAction, counterRedeemAction } from '@/lib/branch/actions'
import { getCurrentProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ qr?: string; phone?: string; branch?: string; added?: string; redeemed?: string; error?: string }>
}

const ERROR_KEYS = ['points', 'minRedeem', 'unavailable', 'time', 'duplicate', 'forbidden', 'input', 'generic', 'move', 'reason', 'signin', 'cart']

// Counter desk. Find a customer by QR or phone, then add a receipt or redeem points.
export default async function PointsDesk({ params, searchParams }: Props) {
  const { locale } = await params
  const { qr, phone, branch: branchParam, added, redeemed, error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('pointsDesk')
  const te = await getTranslations('errors')
  const isAr = locale === 'ar'

  const profile = await getCurrentProfile()
  if (!profile) redirect(`/${locale}/staff/login`)

  const supabase = await createClient()
  const { data: branches } = await supabase.from('branches').select('id, slug, name_ar, name_en').order('name_en')
  const branch = profile.branch_id ? branches?.find((b) => b.id === profile.branch_id) : branches?.find((b) => b.slug === branchParam)

  let customer: { customer_id: string; full_name: string | null; masked_phone: string; balance: number } | null = null
  const lookupValue = qr ? `qr=${encodeURIComponent(qr)}` : phone ? `phone=${encodeURIComponent(phone)}` : ''
  if (lookupValue) {
    const { data } = await supabase.rpc('find_customer', { p_qr: qr ?? null, p_phone: phone ?? null })
    customer = (Array.isArray(data) ? data[0] : data) ?? null
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <h1 className="text-xl font-extrabold text-brand">{t('title')}</h1>

      {added && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{t('added', { points: added })}</p>}
      {redeemed && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{t('redeemed', { amount: redeemed })}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{te(ERROR_KEYS.includes(error) ? error : 'generic')}</p>}

      <form method="get" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-bold">{t('lookup')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="qr" placeholder={t('qrPlaceholder')} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" dir="ltr" />
          <input name="phone" type="tel" placeholder={t('phonePlaceholder')} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" dir="ltr" />
        </div>
        {profile.role === 'admin' && branch && <input type="hidden" name="branch" value={branch.slug} />}
        <button type="submit" className="w-full rounded-xl bg-brand py-2.5 font-bold text-white">{t('search')}</button>
      </form>

      {lookupValue && !customer && <p className="rounded-xl bg-slate-100 p-4 text-slate-600">{t('notFound')}</p>}

      {customer && branch && (
        <section className="space-y-5">
          <div className="rounded-2xl bg-brand p-5 text-white">
            <p className="text-sm text-white/70">{t('customer')}</p>
            <p className="text-lg font-extrabold">{customer.full_name ?? '—'}</p>
            <p className="text-sm" dir="ltr">{customer.masked_phone}</p>
            <p className="mt-3 text-3xl font-extrabold">{customer.balance} <span className="text-sm font-semibold">{t('points')}</span></p>
          </div>

          <form action={addReceiptAction} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-bold">{t('addReceipt')}</p>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customer_id" value={customer.customer_id} />
            <input type="hidden" name="branch" value={branch.slug} />
            <input type="hidden" name="lookup" value={lookupValue} />
            <input name="receipt_no" required placeholder={t('receiptNo')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr" />
            <div className="grid grid-cols-2 gap-2">
              <input name="coffee" type="number" min="0" step="0.01" placeholder={t('coffee')} className="rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr" />
              <input name="food" type="number" min="0" step="0.01" placeholder={t('food')} className="rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr" />
            </div>
            <button type="submit" className="w-full rounded-xl bg-brand py-2.5 font-bold text-white">{t('add')}</button>
          </form>

          <form action={counterRedeemAction} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-bold">{t('redeem')}</p>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="customer_id" value={customer.customer_id} />
            <input type="hidden" name="branch" value={branch.slug} />
            <input type="hidden" name="lookup" value={lookupValue} />
            <input name="points" type="number" min="1" step="1" required placeholder={t('pointsToRedeem')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" dir="ltr" />
            <button type="submit" className="w-full rounded-xl bg-brand-accent py-2.5 font-bold text-brand">{t('redeemAction')}</button>
          </form>
        </section>
      )}

      <p className="text-xs text-slate-500">{isAr ? `الفرع: ${branch ? (branch.name_ar) : '—'}` : `Branch: ${branch?.name_en ?? '—'}`}</p>
    </div>
  )
}
