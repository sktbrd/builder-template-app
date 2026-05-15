'use client'

import {
  clankerTokenRequest,
  type ClankerTokenFragment,
} from '@buildeross/sdk/subgraph'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import type { Address } from 'viem'

import { CoinDetail } from '@/components/coins/CoinDetail'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

type Props = {
  address: Address
  initial: ClankerTokenFragment | null
}

const SWR_KEY = 'clanker-token-detail'
const POLL_INTERVAL_MS = 3_000
const INDEX_TIMEOUT_MS = 90_000

/**
 * The server tries `clankerTokenRequest` once. Right after a deploy the Goldsky
 * subgraph hasn't usually caught up yet, so `initial` is `null`. We poll until
 * it returns, then render `<CoinDetail>`. After ~90s without data we show a
 * friendly "still indexing" state with an escape hatch to clanker.world.
 */
export function CoinDetailLoader({ address, initial }: Props) {
  const { data, isLoading, error } = useSWR(
    [SWR_KEY, daoConfig.chainId, address] as const,
    async ([, chainId, tokenAddress]) => clankerTokenRequest(tokenAddress, chainId),
    {
      fallbackData: initial,
      refreshInterval: (current) => (current ? 0 : POLL_INTERVAL_MS),
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 1_000,
    }
  )

  if (data) return <CoinDetail coin={data} />
  return <IndexingState address={address} isLoading={isLoading} error={error} />
}

function IndexingState({
  address,
  isLoading,
  error,
}: {
  address: Address
  isLoading: boolean
  error: unknown
}) {
  const [stillEarly, setStillEarly] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setStillEarly(false), INDEX_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface-2 px-6 py-14 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-fg" />
      <div>
        <h2 className="text-lg font-bold">
          {stillEarly ? 'Indexing your coin…' : 'Coin not indexed yet'}
        </h2>
        <p className="mt-1 text-sm text-muted-fg">
          {stillEarly
            ? 'The deploy succeeded on-chain. The Builder subgraph usually catches up within 30 seconds.'
            : 'The Builder subgraph still hasn’t indexed this coin. It may be on a chain or paired token the indexer skips — try refreshing in a few minutes.'}
        </p>
      </div>
      <div className="font-mono text-[12px] text-muted-fg">{address}</div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <a
          href={`https://clanker.world/clanker/${address}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button type="button" variant="outline" size="sm">
            View on clanker.world
          </Button>
        </a>
        <Link href="/coins">
          <Button type="button" variant="ghost" size="sm">
            All coins
          </Button>
        </Link>
      </div>
      {error && !isLoading ? (
        <div className="text-[11.5px] text-destructive">
          {error instanceof Error ? error.message : 'Subgraph fetch failed.'}
        </div>
      ) : null}
    </div>
  )
}
