// Pure cart logic. The cart lives in localStorage on the device; the server re-checks everything on order.

export type CartLine = { productId: string; quantity: number }
export type Cart = { branchSlug: string; lines: CartLine[] }

export const MAX_QUANTITY = 20

export function addToCart(cart: Cart | null, branchSlug: string, productId: string): Cart {
  // Items from another branch are dropped. Each order belongs to one branch.
  const base: Cart = cart && cart.branchSlug === branchSlug ? cart : { branchSlug, lines: [] }
  const existing = base.lines.find((l) => l.productId === productId)
  const lines = existing
    ? base.lines.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.min(l.quantity + 1, MAX_QUANTITY) } : l,
      )
    : [...base.lines, { productId, quantity: 1 }]
  return { branchSlug, lines }
}

export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  const q = Math.max(0, Math.min(Math.trunc(quantity), MAX_QUANTITY))
  const lines = q === 0
    ? cart.lines.filter((l) => l.productId !== productId)
    : cart.lines.map((l) => (l.productId === productId ? { ...l, quantity: q } : l))
  return { ...cart, lines }
}

export function cartCount(cart: Cart | null): number {
  return cart ? cart.lines.reduce((sum, l) => sum + l.quantity, 0) : 0
}

export function parseCart(raw: string | null): Cart | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Cart
    if (typeof value.branchSlug !== 'string' || !Array.isArray(value.lines)) return null
    const lines = value.lines.filter(
      (l) => typeof l.productId === 'string' && Number.isInteger(l.quantity) && l.quantity > 0,
    )
    return { branchSlug: value.branchSlug, lines }
  } catch {
    return null
  }
}
