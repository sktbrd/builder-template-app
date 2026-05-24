'use client'

import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { useTweaks } from '@/lib/tweaks-context'
import type { ProposalSummary } from '@/lib/dao-data'
import type { ProposalStatus } from '@/lib/types'

import { TreasuryInsufficientBadge } from './TreasuryInsufficientBadge'
import { VoteBar } from './VoteBar'

function proposalGradient(id: number) {
  const h1 = (id * 47) % 360
  const h2 = (h1 + 50) % 360
  return `linear-gradient(135deg, hsl(${h1} 55% 22%) 0%, hsl(${h2} 65% 16%) 100%)`
}

const STATUS_CHIP: Record<ProposalStatus, { color: string; bg: string; label: string }> = {
  pending:   { color: 'text-warning',       bg: 'bg-warning/15',      label: 'Pending' },
  active:    { color: 'text-accent-strong', bg: 'bg-accent/15',       label: 'Active' },
  cancelled: { color: 'text-muted-fg',      bg: 'bg-surface-2',       label: 'Cancelled' },
  defeated:  { color: 'text-destructive',   bg: 'bg-destructive/15',  label: 'Defeated' },
  succeeded: { color: 'text-success',       bg: 'bg-success/15',      label: 'Succeeded' },
  queued:    { color: 'text-accent-strong', bg: 'bg-accent/10',       label: 'Queued' },
  expired:   { color: 'text-muted-fg',      bg: 'bg-surface-2',       label: 'Expired' },
  executed:  { color: 'text-success',       bg: 'bg-success/20',      label: 'Executed' },
  vetoed:    { color: 'text-destructive',   bg: 'bg-destructive/15',  label: 'Vetoed' },
}

export function ProposalCard({ p }: { p: ProposalSummary }) {
  const { tweaks } = useTweaks()
  const chip = STATUS_CHIP[p.status]

  const reqParts = [
    p.requested.eth  > 0 ? `${p.requested.eth} ETH` : '',
    p.requested.usdc > 0 ? `${p.requested.usdc.toLocaleString('en-US')} USDC` : '',
  ].filter(Boolean)
  const reqStr = reqParts.join(' · ')
  const hasReq = reqParts.length > 0

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex flex-col rounded-xl border border-border bg-surface text-left text-fg transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong overflow-hidden"
    >
      {tweaks.showProposalThumbnails && (
        <div className="relative h-[140px] w-full shrink-0 overflow-hidden">
          {p.thumbnail ? (
            <Image src={p.thumbnail} alt="" fill className="object-cover" unoptimized />
          ) : (
            <div className="h-full w-full" style={{ background: proposalGradient(p.id) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="absolute bottom-2 left-3 font-mono text-[11px] font-semibold text-white/60">
            #{p.id}
          </span>
        </div>
      )}

      <div className={cn(
        'flex flex-1 flex-col gap-3.5',
        tweaks.showProposalThumbnails ? 'px-[22px] pb-[22px]' : 'px-[22px] py-[22px]',
      )}>
        {/* Prop ID + status chip */}
        <div className="flex items-center justify-between">
          {!tweaks.showProposalThumbnails && (
            <span className="font-mono text-[12.5px] text-muted-fg">Prop {p.id}</span>
          )}
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-mono text-[10.5px] font-semibold uppercase tracking-widest',
            tweaks.showProposalThumbnails && 'ml-auto',
            chip.color,
            chip.bg,
          )}>
            <span className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full bg-current',
              p.status === 'active' && 'animate-pulse',
            )} />
            {chip.label}
          </span>
        </div>

        {/* Title — 2-line clamp */}
        <p className="line-clamp-2 text-[18px] font-semibold leading-[1.3] text-fg m-0"
           style={{ minHeight: 'calc(2 * 1.3em)' }}>
          {p.title}
        </p>

        {/* Vote bar + inline for/against tallies */}
        <div className="flex flex-col gap-2">
          <VoteBar
            forV={p.forVotes}
            against={p.againstVotes}
            abstain={p.abstainVotes}
            quorum={p.quorum}
            height={6}
          />
          <div className="flex gap-3.5 tabular-nums text-[12.5px] text-muted-fg">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 shrink-0 rounded-sm bg-vote-for not-italic" />
              <strong className="font-semibold text-fg-2">{p.forVotes.toLocaleString()}</strong> for
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 shrink-0 rounded-sm bg-vote-against not-italic" />
              <strong className="font-semibold text-fg-2">{p.againstVotes.toLocaleString()}</strong> against
            </span>
            {p.abstainVotes > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 shrink-0 rounded-sm bg-vote-abstain not-italic" />
                <strong className="font-semibold text-fg-2">{p.abstainVotes.toLocaleString()}</strong> abstain
              </span>
            )}
          </div>
        </div>

        {/* Footer — always present */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3.5 text-[13px]">
          <span className="min-w-0 truncate text-muted-fg">
            <span className="font-medium text-fg-2">{p.proposerEns ?? p.proposer}</span>
            {' · '}{p.date}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {p.treasuryInsufficient && <TreasuryInsufficientBadge />}
            {hasReq
              ? <span className="font-semibold text-fg tabular-nums">{reqStr}</span>
              : <span className="text-muted-fg">No funds</span>
            }
          </div>
        </div>
      </div>
    </Link>
  )
}
