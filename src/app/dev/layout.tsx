import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Dev-only visual harnesses (`/dev/*`) — the proposal-state matrix and the
 * AuctionHero state matrix. They render fixtures, not DAO data, and must never
 * be reachable in a deployed fork (crawlable, brand-confusing, dead weight).
 * Gating here covers every `/dev/*` page from one server boundary and mirrors
 * the `NODE_ENV` guard already used by `/api/dev/apply-theme`.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <>{children}</>
}
