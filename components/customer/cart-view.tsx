'use client'

import { useMemo, useState } from 'react'
import { placeOrderAction } from '@/lib/orders/actions'
import { calculatePoints, redeemDiscount, type LoyaltyRules } from '@/lib/loyalty/points'
import { MAX_QUANTITY, setQuantity, type Cart } from '@/lib/cart/cart'
import { useStoredCart, writeCart } from './cart-store'

export type CartProduct = { id: string; name: string; price: number; type: 'coffee' | 'food' | 'other' }
export type CartBranch = { slug: string; name: string }

export type CartLabels = Record<string, string>

export function CartView({
  locale,
  labels,
  products,
  branches,
  availability,
  balance,
  rules,
  errorKey,
  isLoggedIn,
  currency,
}: {
  locale: string
  labels: CartLabels
  products: CartProduct[]
  branches: CartBranch[]
  availability: Record<string, string[]>
  balance: number
  rules: LoyaltyRules & { large_order_total_egp: number | null }
  errorKey: string | null
  isLoggedIn: boolean
  currency: string
}) {
  const stored = useStoredCart()
  const loaded = stored !== undefined
  const cart: Cart | null = stored ?? null
  const [type, setType] = useState<'pickup_asap' | 'pickup_scheduled' | 'reservation'>('pickup_asap')
  const [when, setWhen] = useState('')
  const [redeem, setRedeem] = useState(0)

  const branch = branches.find((b) => b.slug === cart?.branchSlug)
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const offered = new Set(cart ? availability[cart.branchSlug] ?? [] : [])

  const lines = (cart?.lines ?? []).map((l) => ({ ...l, product: byId.get(l.productId) }))
  const unavailable = lines.filter((l) => !offered.has(l.productId)).map((l) => l.product?.name ?? '')
  const subtotal = lines.reduce((s, l) => s + (l.product ? l.product.price * l.quantity : 0), 0)
  const coffee = lines.reduce((s, l) => s + (l.product?.type === 'coffee' ? (l.product.price * l.quantity) : 0), 0)
  const food = lines.reduce((s, l) => s + (l.product?.type === 'food' ? (l.product.price * l.quantity) : 0), 0)
  const earn = calculatePoints({ coffee, food }, rules)

  const usable = redeem >= rules.min_redeem_points && redeem <= balance
  const discount = usable && redeem > 0 ? redeemDiscount(redeem, subtotal, rules) : 0
  const total = Math.max(0, subtotal - discount)
  const needsConfirm = rules.large_order_total_egp !== null && subtotal >= rules.large_order_total_egp
  const canSubmit = isLoggedIn && lines.length > 0 && unavailable.length === 0 && (type === 'pickup_asap' || when !== '')

  function update(productId: string, quantity: number) {
    if (!cart) return
    const next = setQuantity(cart, productId, quantity)
    writeCart(next.lines.length ? next : null)
  }

  if (!loaded) return <p className="text-slate-500">{labels.loading}</p>

  if (!cart || lines.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p className="font-semibold text-slate-700">{labels.empty}</p>
        <a href={`/${locale}/menu`} className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 font-bold text-white">
          {labels.emptyCta}
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">{labels.branch}</p>
        <p className="font-bold text-brand">{branch?.name ?? cart.branchSlug}</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.product?.name ?? '—'}</p>
                {!offered.has(l.productId) && (
                  <p className="text-xs font-semibold text-brand-red">{labels.unavailableItem}</p>
                )}
              </div>
              <div className="flex items-center gap-2" aria-label={labels.quantity}>
                <button type="button" onClick={() => update(l.productId, l.quantity - 1)} className="size-8 rounded-full bg-slate-100 font-bold">−</button>
                <span className="w-6 text-center font-bold">{l.quantity}</span>
                <button
                  type="button"
                  onClick={() => update(l.productId, Math.min(l.quantity + 1, MAX_QUANTITY))}
                  className="size-8 rounded-full bg-slate-100 font-bold"
                >+</button>
              </div>
              <p className="w-16 text-end font-bold text-brand">{((l.product?.price ?? 0) * l.quantity).toFixed(0)} {currency}</p>
            </li>
          ))}
        </ul>
      </section>

      <form action={placeOrderAction} className="space-y-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="branch" value={cart.branchSlug} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="scheduled" value={type === 'pickup_asap' ? '' : when} />
        <input type="hidden" name="redeem" value={usable ? redeem : 0} />
        <input type="hidden" name="payload" value={JSON.stringify(lines.map((l) => ({ productId: l.productId, quantity: l.quantity })))} />

        <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <p className="font-bold">{labels.whenTitle}</p>
          <div className="grid grid-cols-3 gap-2 text-sm font-bold">
            {(['pickup_asap', 'pickup_scheduled', 'reservation'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-2xl px-2 py-3 ${type === t ? 'bg-brand text-white' : 'bg-slate-100 text-brand'}`}
              >
                {labels[t]}
              </button>
            ))}
          </div>
          {type !== 'pickup_asap' && (
            <label className="block text-sm font-semibold">
              {type === 'reservation' ? labels.reservationAt : labels.todayAt}
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                dir="ltr"
              />
            </label>
          )}
          {needsConfirm && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{labels.largeOrder}</p>}
        </section>

        {isLoggedIn && (
          <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
            <p className="font-bold">{labels.redeemTitle}</p>
            <p className="text-sm text-slate-500">
              {labels.balance}: <strong className="text-brand">{balance}</strong> · {labels.redeemMin}: {rules.min_redeem_points}
            </p>
            <input
              type="number"
              min={0}
              max={balance}
              step={1}
              value={redeem || ''}
              onChange={(e) => setRedeem(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              dir="ltr"
            />
          </section>
        )}

        <section className="space-y-2 rounded-3xl bg-white p-4 shadow-sm text-sm">
          <Row label={labels.subtotal} value={`${subtotal.toFixed(2)} ${currency}`} />
          {discount > 0 && <Row label={labels.discount} value={`−${discount.toFixed(2)} ${currency}`} />}
          <Row label={labels.total} value={`${total.toFixed(2)} ${currency}`} strong />
          <p className="pt-1 text-xs text-slate-500">{labels.earnPrefix} {earn} {labels.pointsWord}</p>
        </section>

        {unavailable.length > 0 && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{labels.unavailableNote}</p>
        )}
        {errorKey && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{labels[`err_${errorKey}`] ?? labels.err_generic}</p>
        )}

        {isLoggedIn ? (
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-brand py-4 text-lg font-extrabold text-white disabled:opacity-40"
          >
            {labels.submit} · {total.toFixed(2)} {currency}
          </button>
        ) : (
          <a href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/cart`)}`} className="block w-full rounded-2xl bg-brand py-4 text-center text-lg font-extrabold text-white">
            {labels.loginToOrder}
          </a>
        )}
        <p className="text-center text-xs text-slate-500">{labels.payAtBranch}</p>
      </form>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-extrabold text-brand' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
