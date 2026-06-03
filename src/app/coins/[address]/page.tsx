import { zoraCoinRequest } from '@buildeross/sdk/subgraph'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAddress, isAddress } from 'viem'

import { CoinDetailLoader } from '@/components/coins/CoinDetailLoader'
import { assertCoinsEnabled } from '@/lib/coins-gate'
import { daoConfig } from '@/lib/dao.config'

export const revalidate = 30

type Params = Promise<{ address: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { address } = await params
  if (!isAddress(address) || !isChainIdSupportedByCoining(daoConfig.chainId)) {
    return { title: 'Coin' }
  }
  const coin = await zoraCoinRequest(address, daoConfig.chainId)
  if (!coin) return { title: 'Coin' }
  return {
    title: `${coin.name ?? 'Coin'} ($${coin.symbol ?? ''})`,
    description: `Zora content coin in the ${daoConfig.name} context.`,
    alternates: { canonical: `/coins/${address}` },
  }
}

export default async function CoinDetailPage({ params }: { params: Params }) {
  assertCoinsEnabled()
  const { address } = await params
  if (!isAddress(address)) notFound()
  if (!isChainIdSupportedByCoining(daoConfig.chainId)) notFound()

  // Try server-side once. If the subgraph hasn't indexed yet (typical right
  // after a deploy), pass `null` and let the client component poll until it
  // does. We don't `notFound()` on null for a valid address — the loader
  // surfaces an indexing state with an escape hatch.
  const initial = await zoraCoinRequest(address, daoConfig.chainId)
  const checksummed = getAddress(address)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/coins"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All coins
        </Link>
      </div>
      <CoinDetailLoader address={checksummed} initial={initial} />
    </div>
  )
}
