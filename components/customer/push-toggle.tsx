'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription } from '@/lib/notifications/subscriptions'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Opt-in for browser push. Needs the user's click (browsers require it for the permission prompt).
export function PushToggle({
  vapidPublicKey,
  labels,
}: {
  vapidPublicKey: string | undefined
  labels: { enable: string; enabled: string; unsupported: string; denied: string; failed: string }
}) {
  const [state, setState] = useState<'checking' | 'off' | 'on' | 'unsupported' | 'denied' | 'failed'>('checking')

  useEffect(() => {
    // Only check support and existing subscription here. All state updates happen in async callbacks.
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && Boolean(vapidPublicKey)
    if (!supported) {
      setTimeout(() => setState('unsupported'), 0)
      return
    }
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off')
    })
  }, [vapidPublicKey])

  async function enable() {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState('denied')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      })
      const json = sub.toJSON()
      const ok = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      })
      setState(ok.ok ? 'on' : 'failed')
    } catch {
      setState('failed')
    }
  }

  if (state === 'checking') return null
  if (state === 'unsupported') return <p className="text-sm text-slate-500">{labels.unsupported}</p>
  if (state === 'denied') return <p className="text-sm text-slate-500">{labels.denied}</p>
  if (state === 'failed') return <p className="text-sm text-brand-red">{labels.failed}</p>
  if (state === 'on') return <p className="text-sm font-semibold text-emerald-700">{labels.enabled}</p>
  return (
    <button type="button" onClick={enable} className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white">
      {labels.enable}
    </button>
  )
}
