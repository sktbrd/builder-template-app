'use client'

import { SWR_KEYS } from '@buildeross/constants/swrKeys'
import { daoZoraCoinsRequest } from '@buildeross/sdk/subgraph'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

import { CoinCard } from '@/components/coins/CoinCard'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

export function CoinsListView() {
  const supported = isChainIdSupportedByCoining(daoConfig.chainId)

  const { data, isLoading, error } = useSWR(
    supported
      ? ([
          SWR_KEYS.DAO_INFO,
          'zora-coins',
          daoConfig.chainId,
          daoConfig.addresses.token,
        ] as const)
      : null,
    async ([, , chainId, daoAddress]) =>
      daoZoraCoinsRequest(daoAddress as string, chainId as number, 100),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
    }
  )

  if (!supported) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <h2 className="text-lg font-bold">Coins are not supported on this chain</h2>
        <p className="mt-1 text-sm text-muted-fg">
          Builder&apos;s Zora content-coin factory is only deployed on Base and Base
          Sepolia.
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
            Zora content coins backed by {daoConfig.name}&apos;s creator coin.
          </p>
        </div>
        <Link href="/coins/new">
          <Button type="button" size="md" className="min-h-11 md:min-h-10">
            <Plus className="h-4 w-4" />
            Create coin
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load coins: {(error as Error).message}
        </div>
      )}

      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="aspect-square w-full bg-surface-2" />
              <div className="flex flex-col gap-1 px-4 py-3">
                <div className="h-4 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-1/3 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && (!data || data.length === 0) && (
        <div className="mx-auto w-full max-w-md rounded-xl border border-dashed border-border bg-surface-2 px-6 py-12 text-center text-muted-fg">
          <p className="text-sm">No coins have been launched in this DAO yet.</p>
          <p className="mt-2 text-[12.5px]">
            Be the first — every trade routes through {daoConfig.name}&apos;s creator
            coin, so the DAO benefits.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((coin) => (
            <CoinCard key={coin.coinAddress} coin={coin} />
          ))}
        </div>
      )}
    </div>
  )
}
