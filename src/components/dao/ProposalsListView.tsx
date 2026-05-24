'use client'

import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { ProposalCard } from '@/components/dao/ProposalCard'
import { Button } from '@/components/ui/button'
import type { ProposalSummary } from '@/lib/dao-data'
import type { ProposalStatus } from '@/lib/types'

type StatusFilter = ProposalStatus | 'all' | 'hide-cancelled'

const HIDDEN_BY_DEFAULT: ProposalStatus[] = ['cancelled', 'vetoed', 'expired']

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'hide-cancelled', label: 'All statuses' },
  { value: 'all', label: 'Include cancelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'queued', label: 'Queued' },
  { value: 'executed', label: 'Executed' },
  { value: 'defeated', label: 'Defeated' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
  { value: 'vetoed', label: 'Vetoed' },
]

export function ProposalsListView({ proposals }: { proposals: ProposalSummary[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('hide-cancelled')

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    return proposals.filter((p) => {
      const matchesStatus =
        status === 'all' ||
        (status === 'hide-cancelled' && !HIDDEN_BY_DEFAULT.includes(p.status)) ||
        p.status === status
      return matchesStatus && p.title.toLowerCase().includes(ql)
    })
  }, [proposals, q, status])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Proposals
          </h1>
          <p className="mt-1 text-muted-fg">
            How the community funds projects, media, and public work.
          </p>
        </div>
        <Button asChild className="self-start">
          <Link href="/proposals/new">
            <Plus className="h-4 w-4" />
            Create proposal
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex w-full min-w-0 flex-1 items-center rounded-md border border-border bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 sm:w-auto sm:min-w-[280px]">
          <Search className="h-4 w-4 text-muted-fg" />
          <input
            type="text"
            placeholder="Search proposals…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ml-2 min-h-11 flex-1 border-0 bg-transparent py-2.5 text-base outline-none sm:min-h-0 sm:text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-11 w-full rounded-md border border-border bg-surface px-3.5 text-base outline-none focus:border-accent sm:h-10 sm:w-auto sm:text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-muted-fg">
          Showing {filtered.length} of {proposals.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-6 py-14 text-center text-muted-fg">
          No proposals match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
