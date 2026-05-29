'use client'

import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Wraps page content on the standard 1180px column — every route, including the
 * dashboard. The dashboard's auction carousel breaks out to full-bleed width on
 * its own (see AuctionHistoryStrip); everything else stays on the column.
 *
 * Every route gets a top gap below the sticky header (`pt-8`) EXCEPT the home
 * dashboard: its tinted hero owns the full top band as a background, so it must
 * sit flush against the header.
 */
export function MainContainer({ children }: { children: React.ReactNode }) {
  const isHome = (usePathname() ?? '/') === '/'
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-[1180px] flex-1 px-4 pb-20 sm:px-6',
        !isHome && 'pt-8'
      )}
    >
      {children}
    </main>
  )
}
