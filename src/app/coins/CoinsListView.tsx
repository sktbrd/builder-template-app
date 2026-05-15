'use client'

import { useClankerTokens } from '@buildeross/hooks'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'

import { CoinCard } from '@/components/coins/CoinCard'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

export function CoinsListView() {
  const supported = isChainIdSupportedByCoining(daoConfig.chainId)

  const { data, isLoading, error } = useClankerTokens({
    chainId: daoConfig.chainId,
    collectionAddress: daoConfig.addresses.token,
    enabled: supported,
    first: 100,
  })

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <h2 className="text-lg font-bold">Coins are not supported on this chain</h2>
        <p className="mt-1 text-sm text-muted-fg">
          Clanker deployments are only available on Base and Base Sepolia today.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
            Coins
          </h1>
          <p className="mt-1 text-muted-fg">
            Clanker coins launched in the {daoConfig.name} context.
          </p>
        </div>
        <Link href="/coins/new">
          <Button type="button" size="md">
            <Plus className="h-4 w-4" />
            Create coin
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load coins: {error.message}
        </div>
      )}

      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-xl border border-border bg-surface-2"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 px-6 py-12 text-center text-muted-fg">
          <p className="text-sm">No coins have been launched in this DAO yet.</p>
          <p className="mt-2 text-[12.5px]">
            Be the first — coins you deploy here are paired with WETH and indexed under{' '}
            {daoConfig.name}.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((coin) => (
            <CoinCard key={coin.tokenAddress} coin={coin} />
          ))}
        </div>
      )}
    </div>
  )
}
