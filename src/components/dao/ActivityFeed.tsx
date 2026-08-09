'use client'

import Link from 'next/link'
import { useState } from 'react'

import { cn } from '@/lib/utils'

const DOT: Record<string, string> = {
  bid: 'bg-accent',
  vote: 'bg-success',
  prop: 'bg-warning',
}

const LABEL: Record<string, string> = {
  bid: 'Bid',
  vote: 'Vote',
  prop: 'Proposal',
}

export type ActivityFeedItem = {
  type: 'bid' | 'vote' | 'prop'
  who: string
  what: string
  timeAgo: string
  href?: string
}

type Filter = 'all' | 'bid' | 'prop'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bid', label: 'Bids' },
  { key: 'prop', label: 'Props' },
]

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = filter === 'all' ? items : items.filter((i) => i.type === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-3 flex gap-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === f.key ? 'bg-surface-2 text-fg' : 'text-muted-fg hover:text-fg'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-fg">
          No{' '}
          {filter === 'all' ? 'recent activity' : filter === 'bid' ? 'bids' : 'proposals'}{' '}
          yet.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((a, i) => {
            const inner = (
              <div className="flex items-start gap-3 py-3">
                <span
                  className={cn(
                    'mt-[5px] h-2 w-2 shrink-0 rounded-full',
                    DOT[a.type] ?? 'bg-muted-fg'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold text-fg">{a.who}</span>{' '}
                    <span className="text-muted-fg">{a.what}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-fg">
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {LABEL[a.type] ?? a.type}
                    </span>
                    <span>{a.timeAgo}</span>
                  </p>
                </div>
              </div>
            )

            return (
              <li key={i}>
                {a.href ? (
                  <Link
                    href={a.href}
                    className="block transition-colors hover:text-accent-strong"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
