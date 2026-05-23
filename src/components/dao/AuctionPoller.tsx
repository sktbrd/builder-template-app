'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Refreshes server data every `intervalMs` ms while the auction is live. */
export function AuctionPoller({ active, intervalMs = 30_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs, router])

  return null
}
