'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { writeCart } from './cart-store'

// Refreshes the order page when its status changes. On a fresh order, empties the cart.
export function OrderTracker({ orderId, placed }: { orderId: string; placed: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (placed) writeCart(null)
  }, [placed])

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () =>
        router.refresh(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, router])

  return null
}
