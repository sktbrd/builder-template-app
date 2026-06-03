import type { Metadata } from 'next'

import { WalletPill } from '@/components/dao/WalletPill'
import { DaoAvatar } from '@/components/DaoAvatar'
import { Markdown } from '@/components/Markdown'
import { daoConfig } from '@/lib/dao.config'
import { getAboutPageData } from '@/lib/dao-data'

export const metadata: Metadata = {
  title: 'About',
}

export const revalidate = 60

export default async function AboutPage() {
  const data = await getAboutPageData()
  const chainName = daoConfig.chain.name
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
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight break-words md:text-4xl lg:text-5xl">
              {daoConfig.name}
            </h1>
            <div className="text-muted-fg">{daoConfig.tagline}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:max-w-3xl">
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
        <h2 className="mb-3 text-xl font-bold tracking-tight md:text-2xl">
          About {daoConfig.name}
        </h2>
        <Markdown className="text-fg-2">{data.description ?? daoConfig.tagline}</Markdown>
      </section>

      {data.founders.length > 0 && (
        <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <h2 className="mb-4 text-xl font-bold tracking-tight md:text-2xl">Founders</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.founders.map((f) => (
              <div
                key={f.wallet}
                className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-4 py-3.5"
              >
                <WalletPill
                  address={f.wallet}
                  ens={f.ens}
                  showAvatar
                  size="md"
                  className="min-w-0 flex-1"
                />
                <div className="shrink-0 text-[12.5px] text-muted-fg">
                  {f.ownershipPct}% share
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">
            Smart contracts
          </h2>
        </div>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {contracts.map((c) => (
            <li
              key={c.label}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3.5 py-3"
            >
              <span className="font-semibold">{c.label}</span>
              <WalletPill
                address={c.addr}
                link={false}
                showCopy
                showExplorer
                chainId={daoConfig.chainId}
                size="sm"
              />
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
      <div className="mt-0.5 text-[17px] font-bold lg:text-2xl">{value}</div>
    </div>
  )
}

function trimDecimals(value: string, max: number): string {
  if (!value || !value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}
