'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

import { DroposalCard } from '@/components/coins/DroposalCard'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { getDroposals } from '@/lib/droposals'
import { isDroposalSupported } from '@/lib/proposal-tx'

export function DroposalsListView() {
  const supported = isDroposalSupported()

  const { data, isLoading, error } = useSWR(
    supported
      ? (['droposals', daoConfig.chainId, daoConfig.addresses.token] as const)
      : null,
    () => getDroposals(100),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
    }
  )

  if (!supported) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <h2 className="text-lg font-bold">Droposals are not supported on this chain</h2>
        <p className="mt-1 text-sm text-muted-fg">
          The Zora NFT Creator factory droposals deploy through is only available on Base.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-fg">
          NFT editions deployed by {daoConfig.name} through governance, mintable on Zora.
        </p>
        <Link href="/proposals/new" className="cap-nudge self-start">
          <Button type="button" size="md" className="min-h-11 md:min-h-10">
            <Plus className="h-4 w-4" />
            Create droposal
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load droposals: {(error as Error).message}
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
          <p className="text-sm">No droposals have been created in this DAO yet.</p>
          <p className="mt-2 text-[12.5px]">
            A droposal is a governance proposal that deploys a Zora NFT edition — pass one
            and it shows up here.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((item) => (
            <DroposalCard key={item.proposalNumber} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
