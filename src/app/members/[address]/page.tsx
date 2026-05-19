import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddressChip } from '@/components/dao/AddressChip'
import { StatusBadge } from '@/components/dao/StatusBadge'
import { daoConfig } from '@/lib/dao.config'
import { getMemberDetail } from '@/lib/dao-data'

export const revalidate = 60

type Params = Promise<{ address: string }>

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
    : '—'

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
        <div className="flex flex-wrap items-center gap-3">
          {detail.active ? (
            <span
              className="inline-block h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px] shadow-success/25"
              title="Active in last 5 proposals"
            />
          ) : (
            <span
              className="inline-block h-2 w-2 rounded-full bg-surface-3"
              title="Dormant"
            />
          )}
          <h1 className="font-display text-[clamp(32px,4.5vw,48px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            {detail.ens ?? detail.addressShort}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddressChip addr={detail.address} />
          <span className="text-[12.5px] text-muted-fg">Joined {joinedLabel}</span>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Tokens held" value={detail.tokensHeld.toLocaleString()} />
        <Kpi label="Voting power" value={detail.votingPower.toLocaleString()} />
        <Kpi label="Votes cast" value={detail.votesCast.length.toLocaleString()} />
        <Kpi
          label="Proposals authored"
          value={detail.proposalsAuthored.length.toLocaleString()}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {/* Voting history */}
          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">
              Voting history
              <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
                {detail.votesCast.length}
              </span>
            </h3>
            {detail.votesCast.length === 0 ? (
              <div className="text-sm text-muted-fg">No votes cast yet.</div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.votesCast.map((v) => (
                  <li
                    key={`${v.proposalNumber}-${v.timestamp}`}
                    className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${VOTE_TONE[v.support]}`}
                      >
                        {v.support}
                      </span>
                      <span className="text-[12.5px] font-semibold text-muted-fg">
                        {v.weight} {v.weight === 1 ? 'vote' : 'votes'}
                      </span>
                      <Link
                        href={`/proposals/${v.proposalNumber}`}
                        className="text-sm font-semibold text-fg hover:underline"
                      >
                        Prop {v.proposalNumber} · {v.proposalTitle}
                      </Link>
                      <StatusBadge status={v.proposalStatus} className="ml-auto" />
                    </div>
                    {v.reason && (
                      <p className="text-[13px] text-muted-fg">
                        &ldquo;{v.reason}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Proposals authored */}
          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">
              Proposals authored
              <span className="ml-2 text-[12.5px] font-normal text-muted-fg">
                {detail.proposalsAuthored.length}
              </span>
            </h3>
            {detail.proposalsAuthored.length === 0 ? (
              <div className="text-sm text-muted-fg">No proposals authored.</div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.proposalsAuthored.map((p) => (
                  <li
                    key={p.proposalNumber}
                    className="flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={`/proposals/${p.proposalNumber}`}
                      className="text-sm font-semibold text-fg hover:underline"
                    >
                      Prop {p.proposalNumber} · {p.title}
                    </Link>
                    <span className="text-[12.5px] text-muted-fg">{p.date}</span>
                    <StatusBadge status={p.status} className="ml-auto" />
                  </li>
                ))}
              </ul>
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
              <div className="flex flex-wrap gap-2">
                {detail.tokens.map((t) => (
                  <span
                    key={t.tokenId}
                    className="inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-fg"
                    title={
                      t.mintedAt
                        ? `Minted ${new Date(t.mintedAt * 1000).toLocaleDateString()}`
                        : undefined
                    }
                  >
                    #{t.tokenId}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {/* Delegation */}
          <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
            <h3 className="mb-3 text-base font-bold">Delegation</h3>
            <dl className="flex flex-col gap-3 text-[13px]">
              <div className="flex flex-col gap-1">
                <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
                  Delegates to
                </dt>
                <dd>
                  {selfDelegated ? (
                    <span className="text-fg">Self-delegated</span>
                  ) : hasDelegate ? (
                    <Link
                      href={`/members/${detail.delegate}`}
                      className="font-semibold text-accent-strong hover:underline"
                    >
                      {detail.delegateEns ?? detail.delegateShort}
                    </Link>
                  ) : (
                    <span className="text-muted-fg">—</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
                  Delegators
                </dt>
                <dd>
                  {detail.delegators.length === 0 ? (
                    <span className="text-muted-fg">None</span>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {detail.delegators.map((d) => (
                        <li
                          key={d.addr}
                          className="flex items-center justify-between gap-3"
                        >
                          <Link
                            href={`/members/${d.addr}`}
                            className="truncate font-semibold text-fg hover:underline"
                          >
                            {d.ens ?? d.addrShort}
                          </Link>
                          <span className="shrink-0 text-[12px] text-muted-fg">
                            {d.tokenCount} {d.tokenCount === 1 ? 'token' : 'tokens'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* External link */}
          <section className="rounded-xl border border-border bg-surface px-6 py-[22px] text-[13px]">
            <h3 className="mb-3 text-base font-bold">Onchain</h3>
            <a
              href={explorerUrl(daoConfig.chainId, detail.address)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent-strong hover:underline"
            >
              View on block explorer ↗
            </a>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

function explorerUrl(chainId: number, addr: string): string {
  const base =
    {
      1: 'https://etherscan.io',
      10: 'https://optimistic.etherscan.io',
      8453: 'https://basescan.org',
      7777777: 'https://explorer.zora.energy',
    }[chainId] ?? 'https://basescan.org'
  return `${base}/address/${addr}`
}
