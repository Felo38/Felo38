'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/cart/cart'
import { readCart, writeCart } from './cart-store'

export function AddToCartButton({
  productId,
  branchSlug,
  label,
  switchBranchMessage,
  itemName,
}: {
  productId: string
  branchSlug: string
  label: string
  switchBranchMessage: string
  itemName: string
}) {
  const [count, setCount] = useState(0)

  function onAdd() {
    const current = readCart()
    // A cart holds items from one branch. Switching branches empties it, after the customer agrees.
    if (current && current.branchSlug !== branchSlug && current.lines.length > 0) {
      if (!window.confirm(switchBranchMessage)) return
    }
    const next = addToCart(current && current.branchSlug === branchSlug ? current : null, branchSlug, productId)
    writeCart(next)
    setCount(next.lines.find((l) => l.productId === productId)?.quantity ?? 1)
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`${label}: ${itemName}`}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-lg font-extrabold text-brand shadow-sm active:scale-95"
    >
      {count > 0 ? <span className="text-xs">{count}</span> : '+'}
    </button>
  )
}
