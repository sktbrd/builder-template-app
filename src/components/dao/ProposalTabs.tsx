'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  availableProposalTabs,
  parseProposalTab,
  PROPOSAL_TAB_LABELS,
  type ProposalTabKey,
} from '@/lib/proposal-tabs'
import { cn } from '@/lib/utils'

type Props = {
  propdatesSupported: boolean
  /** Badge counts known server-side. Tabs without an entry render no badge. */
  counts: Partial<Record<ProposalTabKey, number>>
  panels: Partial<Record<ProposalTabKey, ReactNode>>
}

function readTabFromLocation(available: readonly ProposalTabKey[]): ProposalTabKey {
  const raw = new URLSearchParams(window.location.search).get('tab')
  return parseProposalTab(raw, available)
}

/**
 * Tab navigation for the proposal detail page.
 *
 * Panels arrive already rendered from the server component, so this file owns
 * only selection. The active tab is mirrored into `?tab=` via
 * `window.history.replaceState` — Next's supported shallow update — which keeps
 * the prerendered HTML complete (no Suspense fallback) while still yielding a
 * shareable link. A panel is mounted the first time it is opened and stays
 * mounted afterwards, so `PropdateThread`'s 15s SWR poll never runs for readers
 * who don't open that tab, and reopening a tab doesn't refetch.
 */
export function ProposalTabs({ propdatesSupported, counts, panels }: Props) {
  const available = useMemo(
    () => availableProposalTabs({ propdatesSupported }),
    [propdatesSupported]
  )
  const [active, setActive] = useState<ProposalTabKey>(() => available[0])
  const [mounted, setMounted] = useState<ProposalTabKey[]>(() => [available[0]])
  const tabRefs = useRef<Partial<Record<ProposalTabKey, HTMLButtonElement | null>>>({})

  // Adopt the deep-linked tab after hydration, and follow back/forward.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(readTabFromLocation(available))
    const onPopState = () => setActive(readTabFromLocation(available))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [available])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted((prev) => (prev.includes(active) ? prev : [...prev, active]))
  }, [active])

  const selectTab = useCallback(
    (key: ProposalTabKey) => {
      setActive(key)
      const params = new URLSearchParams(window.location.search)
      if (key === available[0]) params.delete('tab')
      else params.set('tab', key)
      const query = params.toString()
      window.history.replaceState(
        null,
        '',
        query ? `${window.location.pathname}?${query}` : window.location.pathname
      )
    },
    [available]
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const index = available.indexOf(active)
      let nextIndex = -1
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % available.length
      else if (event.key === 'ArrowLeft')
        nextIndex = (index - 1 + available.length) % available.length
      else if (event.key === 'Home') nextIndex = 0
      else if (event.key === 'End') nextIndex = available.length - 1
      if (nextIndex < 0) return
      event.preventDefault()
      const nextKey = available[nextIndex]
      selectTab(nextKey)
      tabRefs.current[nextKey]?.focus()
    },
    [active, available, selectTab]
  )

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Proposal sections"
        onKeyDown={onKeyDown}
        className="-mx-1 flex items-center gap-1 overflow-x-auto border-b border-border px-1"
      >
        {available.map((key) => {
          const isActive = key === active
          const count = counts[key]
          return (
            <button
              key={key}
              ref={(node) => {
                tabRefs.current[key] = node
              }}
              type="button"
              role="tab"
              id={`proposal-tab-${key}`}
              aria-selected={isActive}
              aria-controls={`proposal-panel-${key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(key)}
              className={cn(
                'relative shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'text-fg' : 'text-muted-fg hover:text-fg'
              )}
            >
              {PROPOSAL_TAB_LABELS[key]}
              {typeof count === 'number' && (
                <span className="ml-1.5 text-[12.5px] font-normal text-muted-fg">
                  {count}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-sm bg-fg" />
              )}
            </button>
          )
        })}
      </div>

      {available.map((key) =>
        mounted.includes(key) ? (
          <div
            key={key}
            role="tabpanel"
            id={`proposal-panel-${key}`}
            aria-labelledby={`proposal-tab-${key}`}
            hidden={key !== active}
            tabIndex={0}
            className="rounded-xl border border-border bg-surface px-4 py-5 sm:px-6 sm:py-[22px]"
          >
            {panels[key]}
          </div>
        ) : null
      )}
    </div>
  )
}
