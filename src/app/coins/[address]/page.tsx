import { clankerTokenRequest } from '@buildeross/sdk/subgraph'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isAddress } from 'viem'

import { CoinDetail } from '@/components/coins/CoinDetail'
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
  const coin = await clankerTokenRequest(address, daoConfig.chainId)
  if (!coin) return { title: 'Coin' }
  return {
    title: `${coin.tokenName ?? 'Coin'} ($${coin.tokenSymbol ?? ''})`,
    description: `Clanker coin deployed in the ${daoConfig.name} context.`,
    alternates: { canonical: `/coins/${address}` },
  }
}

export default async function CoinDetailPage({ params }: { params: Params }) {
  const { address } = await params
  if (!isAddress(address)) notFound()
  if (!isChainIdSupportedByCoining(daoConfig.chainId)) notFound()

  const coin = await clankerTokenRequest(address, daoConfig.chainId)
  if (!coin) notFound()

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
      <CoinDetail coin={coin} />
    </div>
  )
}
