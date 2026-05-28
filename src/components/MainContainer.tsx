'use client'

import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Wraps page content with route-aware width.
 *
 * The dashboard goes full-bleed (matches the nouns.game layout — the hero +
 * auction history strip benefit from the extra room); every other route stays
 * on the standard 1180px column.
 */
export function MainContainer({ children }: { children: React.ReactNode }) {
  const isDashboard = (usePathname() ?? '/') === '/'
  return (
    <main
      className={cn(
        'w-full flex-1',
        isDashboard
          ? // Dashboard is fully edge-to-edge — the hero, history strip, and
            // dark feed/proposals panel all own their own internal padding.
            'max-w-none'
          : 'mx-auto max-w-[1180px] px-4 pb-20 pt-8 sm:px-6'
      )}
    >
      {children}
    </main>
  )
}
