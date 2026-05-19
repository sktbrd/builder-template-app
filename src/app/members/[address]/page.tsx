import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ActiveBadge } from '@/components/dao/ActiveBadge'
import { KpiCard } from '@/components/dao/KpiCard'
import { StatusBadge } from '@/components/dao/StatusBadge'
import { WalletPill } from '@/components/dao/WalletPill'
import { daoConfig } from '@/lib/dao.config'
import { getMemberDetail } from '@/lib/dao-data'
import { resolveIpfs } from '@/lib/utils'

export const revalidate = 60

type Params = Promise<{ address: string }>

const SECTION_CAP = 50

const VOTE_TONE = {
  for: 'text-vote-for bg-vote-for/15 border-vote-for/40',
  against: 'text-vote-against bg-vote-against/15 border-vote-against/40',
  abstain: 'text-muted-fg bg-surface-2 border-border',
} as const

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { address } = await params
  const detail = await getMemberDetail(address)
  if (!detail) return { title: 'Member' }
  const label = detail.ens ?? detail.addressShort
  return { title: `${label} · Members` }
}

export default async function MemberDetailPage({ params }: { params: Params }) {
  const { address } = await params
  const detail = await getMemberDetail(address)
  if (!detail) notFound()

  const selfDelegated =
    detail.delegate !== null &&
    detail.delegate.toLowerCase() === detail.address.toLowerCase()
  const hasDelegate = detail.delegate !== null && !selfDelegated
  const joinedLabel = detail.joinedAt
    ? new Date(detail.joinedAt * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : null

  const votesCapped = detail.votesCast.length >= SECTION_CAP
  const authoredCapped = detail.proposalsAuthored.length >= SECTION_CAP
  const delegatorsCapped = detail.delegators.length >= SECTION_CAP

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/members"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All members
        </Link>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted-fg">
          <ActiveBadge active={detail.active} />
          {joinedLabel && <span>Joined {joinedLabel}</span>}
        </div>
        <h1 className="break-words font-display text-[clamp(32px,4.5vw,48px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
          {detail.ens ?? detail.addressShort}
        </h1>
        <div className="min-w-0 max-w-full">
          <WalletPill
            address={detail.address}
            ens={null}
            link={false}
            showCopy
            showExplorer
            chainId={daoConfig.chainId}
            size="md"
            className="max-w-full"
          />
        </div>
      </header>

      {/* KPI row — 2 tiles instead of 4; votes/authored counts already render
          next to the section titles. */}
      <section className="grid grid-cols-2 gap-3 sm:max-w-md">
        <KpiCard label="Tokens held" value={detail.tokensHeld.toLocaleString()} />
        <KpiCard label="Voting power" value={detail.votingPower.toLocaleString()} />
      </section>

      {/* Delegation — promoted from sidebar to a primary section. */}
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h3 className="mb-3 text-base font-bold">Delegation</h3>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
              Delegates to
            </div>
            {selfDelegated ? (
              <span className="text-sm font-semibold text-fg">Self-delegated</span>
            ) : hasDelegate && detail.delegate ? (
              <WalletPill
                address={detail.delegate}
                ens={detail.delegateEns}
                showAvatar
                size="md"
              />
            ) : (
              <span className="text-sm text-muted-fg">
                No delegation set — no voting power
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
              Delegators
              <span className="ml-2 normal-case tracking-normal text-muted-fg/70">
                {delegatorsCapped ? `${SECTION_CAP}+` : detail.delegators.length}
              </span>
            </div>
            {detail.delegators.length === 0 ? (
              <span className="text-sm text-muted-fg">None</span>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {detail.delegators.map((d) => (
                  <li
                    key={d.addr}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
                  >
                    <WalletPill
                      address={d.addr}
                      ens={d.ens}
                      showAvatar
                      size="sm"
                      className="min-w-0 flex-1"
                    />
                    <span className="shrink-0 text-[12px] text-muted-fg">
                      {d.tokenCount} {d.tokenCount === 1 ? 'token' : 'tokens'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {delegatorsCapped && (
              <div className="text-[12px] text-muted-fg">
                Showing top {SECTION_CAP} delegators by token count.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Voting history */}
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h3 className="mb-3 text-base font-bold">
          Voting history
          <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
            {votesCapped ? `${SECTION_CAP}+` : detail.votesCast.length}
          </span>
        </h3>
        {detail.votesCast.length === 0 ? (
          <div className="text-sm text-muted-fg">No votes cast yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {detail.votesCast.map((v) => (
              <li
                key={`${v.proposalNumber}-${v.timestamp}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${VOTE_TONE[v.support]}`}
                >
                  {v.support}
                </span>
                <Link
                  href={`/proposals/${v.proposalNumber}`}
                  className="min-w-0 truncate text-sm font-semibold text-fg hover:underline"
                >
                  Prop {v.proposalNumber} · {v.proposalTitle}
                </Link>
                <StatusBadge status={v.proposalStatus} />
                <div className="col-start-2 col-end-4 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-fg">
                  <span className="font-semibold">
                    {v.weight} {v.weight === 1 ? 'vote' : 'votes'}
                  </span>
                  {v.reason && (
                    <span className="min-w-0 truncate">&ldquo;{v.reason}&rdquo;</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {votesCapped && (
          <div className="mt-3 text-[12px] text-muted-fg">
            Showing latest {SECTION_CAP} votes.
          </div>
        )}
      </section>

      {/* Proposals authored */}
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h3 className="mb-3 text-base font-bold">
          Proposals authored
          <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
            {authoredCapped ? `${SECTION_CAP}+` : detail.proposalsAuthored.length}
          </span>
        </h3>
        {detail.proposalsAuthored.length === 0 ? (
          <div className="text-sm text-muted-fg">No proposals authored.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {detail.proposalsAuthored.map((p) => (
              <li
                key={p.proposalNumber}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-3 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/proposals/${p.proposalNumber}`}
                  className="min-w-0 truncate text-sm font-semibold text-fg hover:underline"
                >
                  Prop {p.proposalNumber} · {p.title}
                </Link>
                <span className="text-[12.5px] text-muted-fg">{p.date}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
        {authoredCapped && (
          <div className="mt-3 text-[12px] text-muted-fg">
            Showing latest {SECTION_CAP} proposals.
          </div>
        )}
      </section>

      {/* Tokens held */}
      {detail.tokens.length > 0 && (
        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <h3 className="mb-3 text-base font-bold">
            Tokens
            <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
              {detail.tokens.length}
            </span>
          </h3>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {detail.tokens.map((t) => (
              <li key={t.tokenId}>
                <Link
                  href={`/auction/${t.tokenId}`}
                  className="group relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-2"
                  title={
                    t.mintedAt
                      ? `${t.name ?? `#${t.tokenId}`} · minted ${new Date(t.mintedAt * 1000).toLocaleDateString()}`
                      : (t.name ?? `#${t.tokenId}`)
                  }
                >
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveIpfs(t.image)}
                      alt={t.name ?? `Token #${t.tokenId}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted-fg">
                      #{t.tokenId}
                    </div>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-white backdrop-blur-md">
                    #{t.tokenId}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
