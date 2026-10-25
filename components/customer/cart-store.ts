'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { parseCart, type Cart } from '@/lib/cart/cart'

export const CART_KEY = 'otr_cart'

// localStorage can be blocked or full (private mode). A cart that can't be saved must not crash the page.
export function readCart(): Cart | null {
  try {
    return parseCart(window.localStorage.getItem(CART_KEY))
  } catch {
    return null
  }
}

export function writeCart(cart: Cart | null) {
  try {
    if (cart === null) window.localStorage.removeItem(CART_KEY)
    else window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    // Ignore: the cart still works for this page view.
  }
  window.dispatchEvent(new Event('otr-cart'))
}

// Reads the cart and re-renders on change. Returns undefined on the server and before the first read.
export function useStoredCart(): Cart | null | undefined {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('otr-cart', onChange)
      window.addEventListener('storage', onChange)
      return () => {
        window.removeEventListener('otr-cart', onChange)
        window.removeEventListener('storage', onChange)
      }
    },
    () => {
      try {
        return window.localStorage.getItem(CART_KEY)
      } catch {
        return null
      }
    },
    () => undefined,
  )
  return useMemo(() => (raw === undefined ? undefined : parseCart(raw)), [raw])
}
