import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BottomNav, Hero } from '@/components/customer-shell'
import { CartView, type CartProduct } from '@/components/customer/cart-view'
import { getCurrentProfile } from '@/lib/auth/session'
import { listBranchProducts, listBranches, listProducts } from '@/lib/catalog/queries'
import { getBalance, getCurrentRules } from '@/lib/loyalty/queries'
import { pick } from '@/lib/i18n/pick'
import { getNavLabels } from '@/lib/customer/nav'

const ERROR_KEYS = ['points', 'minRedeem', 'unavailable', 'time', 'signin', 'cart', 'input', 'generic', 'forbidden', 'move', 'reason', 'duplicate']

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { locale } = await params
  const { error } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('cart')
  const tc = await getTranslations('common')
  const isAr = locale === 'ar'

  const [branches, products, branchProducts, rules, balance, profile] = await Promise.all([
    listBranches(),
    listProducts(),
    listBranchProducts(),
    getCurrentRules(),
    getBalance(),
    getCurrentProfile(),
  ])

  const slugById = new Map(branches.map((b) => [b.id, b.slug]))
  const availability: Record<string, string[]> = {}
  for (const bp of branchProducts) {
    if (!bp.available) continue
    const slug = slugById.get(bp.branch_id)
    if (!slug) continue
    ;(availability[slug] ??= []).push(bp.product_id)
  }

  const cartProducts: CartProduct[] = products.map((p) => ({
    id: p.id,
    name: isAr ? p.name_ar : p.name_en,
    price: Number(p.price_egp),
    type: p.type,
  }))

  const labels = pick(
    (k) => t(k),
    [
      'loading', 'empty', 'emptyCta', 'branch', 'quantity', 'unavailableItem', 'whenTitle', 'pickup_asap',
      'pickup_scheduled', 'reservation', 'reservationAt', 'todayAt', 'largeOrder', 'redeemTitle', 'balance',
      'redeemMin', 'earnPrefix', 'pointsWord', 'subtotal', 'discount', 'total', 'unavailableNote', 'submit',
      'loginToOrder', 'payAtBranch', ...ERROR_KEYS.map((k) => `err_${k}`),
    ],
  )

  return (
    <>
      <Hero title={t('title')} />
      <main className="mx-auto max-w-md px-5 pb-28 pt-5">
        <CartView
          locale={locale}
          labels={labels}
          products={cartProducts}
          branches={branches.map((b) => ({ slug: b.slug, name: isAr ? b.name_ar : b.name_en }))}
          availability={availability}
          balance={balance}
          rules={rules}
          errorKey={error ?? null}
          isLoggedIn={Boolean(profile)}
          currency={tc('currency')}
        />
      </main>
      <BottomNav locale={locale} labels={await getNavLabels()} />
    </>
  )
}
