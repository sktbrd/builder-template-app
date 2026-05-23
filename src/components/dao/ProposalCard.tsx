'use client'

import Image from 'next/image'
import Link from 'next/link'

import { useTweaks } from '@/lib/tweaks-context'
import type { ProposalSummary } from '@/lib/dao-data'

import { StatusBadge } from './StatusBadge'
import { TreasuryInsufficientBadge } from './TreasuryInsufficientBadge'
import { VoteBar } from './VoteBar'
import { WalletPill } from './WalletPill'

function proposalGradient(id: number) {
  const h1 = (id * 47) % 360
  const h2 = (h1 + 50) % 360
  return `linear-gradient(135deg, hsl(${h1} 55% 22%) 0%, hsl(${h2} 65% 16%) 100%)`
}

export function ProposalCard({ p }: { p: ProposalSummary }) {
  const { tweaks } = useTweaks()
  const total = p.forVotes + p.againstVotes + p.abstainVotes
  const hasReq = p.requested.eth > 0 || p.requested.usdc > 0

  return (
    <Link
      href={`/proposals/${p.id}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-border bg-surface text-left text-fg transition-[transform,border-color] hover:-translate-y-px hover:border-border-strong overflow-hidden"
    >
      {tweaks.showProposalThumbnails && (
        <div className="relative h-[88px] w-full shrink-0 overflow-hidden">
          {p.thumbnail ? (
            <Image
              src={p.thumbnail}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="h-full w-full" style={{ background: proposalGradient(p.id) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="absolute bottom-2 left-3 font-mono text-[11px] font-semibold text-white/60">
            #{p.id}
          </span>
        </div>
      )}
      <div className={['flex flex-col gap-2.5', tweaks.showProposalThumbnails ? 'px-[18px] pb-4' : 'px-[18px] py-4'].join(' ')}>
        <div className="flex items-center justify-between">
          {!tweaks.showProposalThumbnails && (
            <span className="font-mono text-xs font-semibold text-muted-fg">Prop {p.id}</span>
          )}
          <StatusBadge status={p.status} />
        </div>
        <div className="text-[15px] font-semibold leading-snug text-fg">{p.title}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-fg">
          <span className="shrink-0">by</span>
          <WalletPill address={p.proposer} ens={p.proposerEns} link={false} size="xs" />
          <span className="shrink-0">· {p.date}</span>
        </div>
        <div className="mt-auto pt-1">
          <div className="mb-1 text-[12.5px] text-muted-fg">Voting progress</div>
          <VoteBar
            forV={p.forVotes}
            against={p.againstVotes}
            abstain={p.abstainVotes}
            quorum={p.quorum}
            height={6}
          />
          <div className="mt-1 text-[12.5px] text-muted-fg">
            {total} votes · {p.endsLabel}
          </div>
        </div>
        {hasReq && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-[12.5px] text-muted-fg">Requested</span>
            <div className="flex items-center gap-2">
              {p.treasuryInsufficient && <TreasuryInsufficientBadge />}
              <span className="text-sm font-bold">
                {p.requested.eth > 0 && `${p.requested.eth} ETH`}
                {p.requested.eth > 0 && p.requested.usdc > 0 && ' · '}
                {p.requested.usdc > 0 && `${p.requested.usdc.toLocaleString('en-US')} USDC`}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
