import type { Metadata } from 'next'

import { AddressChip } from '@/components/dao/AddressChip'
import { DaoAvatar } from '@/components/DaoAvatar'
import { daoConfig } from '@/lib/dao.config'
import { getAboutPageData } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'About',
}

export const revalidate = 60

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  7777777: 'Zora',
}

export default async function AboutPage() {
  const data = await getAboutPageData()
  const chainName = CHAIN_NAMES[daoConfig.chainId] ?? `Chain ${daoConfig.chainId}`
  const treasuryDisplay = trimDecimals(data.treasuryEth, 4)

  const contracts: Array<{ label: string; addr: string }> = [
    { label: 'NFT (Token)', addr: daoConfig.addresses.token },
    { label: 'Auction House', addr: daoConfig.addresses.auction },
    { label: 'Governor', addr: daoConfig.addresses.governor },
    { label: 'Treasury', addr: daoConfig.addresses.treasury },
    { label: 'Metadata', addr: daoConfig.addresses.metadata },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center gap-4">
          <DaoAvatar
            image={daoConfig.image}
            alt={daoConfig.name}
            fallbackColor={daoConfig.theme.accent}
            size={48}
            priority
          />
          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
              {daoConfig.name}
            </h1>
            <div className="text-muted-fg">{daoConfig.tagline}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KvBlock label="Treasury" value={`${treasuryDisplay} ETH`} />
          <KvBlock label="Owners" value={data.ownerCount.toLocaleString('en-US')} />
          <KvBlock
            label="Total supply"
            value={data.totalSupply.toLocaleString('en-US')}
          />
          <KvBlock label="Chain" value={chainName} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h2 className="mb-3 text-xl font-bold tracking-tight">About {daoConfig.name}</h2>
        <p className="text-fg-2">{daoConfig.tagline}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h2 className="mb-4 text-xl font-bold tracking-tight">Founders</h2>
        {data.founders.length === 0 ? (
          <div className="text-sm text-muted-fg">
            No founders configured for this DAO.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.founders.map((f, i) => (
              <FounderCard
                key={f.wallet}
                addr={f.walletShort}
                share={`${f.ownershipPct}%`}
                hue={(160 + i * 50) % 360}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Smart contracts</h2>
        </div>
        <ul className="flex flex-col gap-2">
          {contracts.map((c) => (
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

function FounderCard({ addr, share, hue }: { addr: string; share: string; hue: number }) {
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

function trimDecimals(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}

function truncate(addr: string) {
  if (addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
