import { isChainIdSupportedByCoining } from '@buildeross/utils'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { daoConfig } from '@/lib/dao.config'
import { isDroposalSupported } from '@/lib/proposal-tx'

import { CoinsListView } from './CoinsListView'
import { ContentTabs } from './ContentTabs'
import { DroposalsListView } from './DroposalsListView'

export const metadata: Metadata = {
  title: 'Content',
  description: `Coins and NFT editions backed by ${daoConfig.name}.`,
  alternates: { canonical: '/coins' },
}

type SearchParams = Promise<{ tab?: string }>

export default async function ContentPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  // Gate consistently with the Header, which only surfaces /coins when the
  // feature flag is on. Without this, the route stays reachable directly even
  // when coins are disabled in daoConfig.
  if (!daoConfig.features.coins) notFound()

  const tab = (await searchParams).tab === 'droposals' ? 'droposals' : 'coins'

  const coinsSupported = isChainIdSupportedByCoining(daoConfig.chainId)
  const droposalsSupported = isDroposalSupported()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
          Content
        </h1>
        <p className="mt-1 text-muted-fg">
          Coins and NFT editions created in the {daoConfig.name} context.
        </p>
      </div>

      {!coinsSupported && !droposalsSupported ? (
        <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface px-6 py-10 text-center">
          <h2 className="text-lg font-bold">Content is not supported on this chain</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Zora content coins and droposals are only available on Base.
          </p>
        </div>
      ) : (
        <>
          <ContentTabs active={tab} />
          {tab === 'droposals' ? <DroposalsListView /> : <CoinsListView />}
        </>
      )}
    </div>
  )
}
