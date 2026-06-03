import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { assertCoinsEnabled } from '@/lib/coins-gate'
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
  assertCoinsEnabled()

  const tab = (await searchParams).tab === 'droposals' ? 'droposals' : 'coins'

  const coinsSupported = isChainIdSupportedByCoining(daoConfig.chainId)
  const droposalsSupported = isDroposalSupported()

  // The top-right create action follows the active tab: "Create coin" deep-links
  // to the coin wizard, "Create droposal" to the proposal wizard (droposals are
  // created as governance proposals). Hidden when the active tab is unsupported.
  const createAction =
    tab === 'droposals'
      ? droposalsSupported
        ? { href: '/proposals/new', label: 'Create droposal' }
        : null
      : coinsSupported
        ? { href: '/coins/new', label: 'Create coin' }
        : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Content
          </h1>
          <p className="mt-1 text-muted-fg">
            Coins and NFT editions created in the {daoConfig.name} context.
          </p>
        </div>
        {createAction && (
          <Link href={createAction.href} className="cap-nudge self-start">
            <Button type="button" size="md" className="min-h-11 md:min-h-10">
              <Plus className="h-4 w-4" />
              {createAction.label}
            </Button>
          </Link>
        )}
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
