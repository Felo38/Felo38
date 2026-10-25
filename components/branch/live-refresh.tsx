'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'

// Listens for order changes at this branch and refreshes the server data. Plays a sound for new orders.
// Browsers only allow audio after a click, so the staff member turns the sound on once.
export function LiveRefresh({
  branchId,
  labels,
}: {
  branchId: string
  labels: { live: string; soundOn: string; soundOff: string; enableSound: string }
}) {
  const router = useRouter()
  const [soundOn, setSoundOn] = useState(false)
  const [live, setLive] = useState(false)
  const soundRef = useRef(false)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    soundRef.current = soundOn
  }, [soundOn])

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`branch-orders-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && soundRef.current) beep(ctxRef)
          router.refresh()
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [branchId, router])

  function enableSound() {
    ctxRef.current ??= new AudioContext()
    void ctxRef.current.resume()
    setSoundOn(true)
    beep(ctxRef)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        {labels.live}
      </span>
      <button
        type="button"
        onClick={soundOn ? () => setSoundOn(false) : enableSound}
        className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white"
      >
        {soundOn ? labels.soundOn : labels.enableSound}
      </button>
    </div>
  )
}

function beep(ctxRef: { current: AudioContext | null }) {
  const ctx = ctxRef.current ?? new AudioContext()
  ctxRef.current = ctx
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 880
  gain.gain.value = 0.2
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.35)
}
