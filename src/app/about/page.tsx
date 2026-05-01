import type { Metadata } from 'next'

import { DaoLogo } from '@/components/DaoLogo'
import { AddressChip } from '@/components/dao/AddressChip'
import { daoConfig } from '@/lib/dao.config'
import { CONTRACTS, PRESETS } from '@/lib/mockData'

export const metadata: Metadata = {
  title: 'About',
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

export default function AboutPage() {
  const preset = PRESETS.builder
  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center gap-4">
          <DaoLogo style="stripes" color={daoConfig.theme.accent} size={48} />
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
              {daoConfig.name}
            </h1>
            <div className="text-muted-fg">{daoConfig.tagline}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KvBlock label="Treasury" value={`${preset.treasuryEth} ETH`} />
          <KvBlock label="Owners" value={preset.members.toLocaleString()} />
          <KvBlock label="Total supply" value={preset.totalSupply.toLocaleString()} />
          <KvBlock label="Chain" value={chainName} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          Powering Onchain Communities.
        </h2>
        <p className="mb-3 text-fg-2">
          The {daoConfig.name} mission is to develop DAO infrastructure as a
          public good, enabling decentralized, inclusive, and transparent
          decision-making processes that empower onchain communities to shape
          their collective futures.
        </p>
        <p className="text-fg-2">
          View the full Mission, Vision and Values. New members: join us in the
          community channel or on Discord.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h2 className="mb-4 text-xl font-bold tracking-tight">Founders</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FounderCard
            addr="0xE2E…6A2E1"
            share="10%"
            hue={200}
          />
          <FounderCard
            addr="0x1cD…Eef21"
            share="5%"
            hue={160}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Smart contracts</h2>
        </div>
        <ul className="flex flex-col gap-2">
          {CONTRACTS.map((c) => (
            <li
              key={c.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3.5 py-3"
            >
              <span className="font-semibold">{c.label}</span>
              <AddressChip addr={truncate(c.addr)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function KvBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12.5px] text-muted-fg">{label}</div>
      <div className="mt-0.5 text-[17px] font-bold">{value}</div>
    </div>
  )
}

function FounderCard({
  addr,
  share,
  hue,
}: {
  addr: string
  share: string
  hue: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface-2 px-4 py-3.5">
      <span
        className="h-10 w-10 shrink-0 rounded-full"
        style={{ background: `oklch(0.85 0.12 ${hue})` }}
      />
      <div>
        <div className="font-mono text-xs">{addr}</div>
        <div className="text-[12.5px] text-muted-fg">{share} share</div>
      </div>
    </div>
  )
}

function truncate(addr: string) {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
