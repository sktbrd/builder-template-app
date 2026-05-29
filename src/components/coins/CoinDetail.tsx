'use client'

import { fetchIpfsMetadata } from '@buildeross/ipfs-service'
import { type ZoraCoinFragment } from '@buildeross/sdk/subgraph'
import { formatTimeAgo } from '@buildeross/utils'
import { DYNAMIC_FEE_FLAG } from '@buildeross/utils/coining'
import { ArrowLeftRight, ExternalLink, Image as ImageIcon } from 'lucide-react'
import useSWR from 'swr'

import { CoinTradeWidget } from '@/components/coins/CoinTradeWidget'
import { CopyRow, FieldRow } from '@/components/coins/detail-rows'
import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { resolveIpfs, shortAddress } from '@/lib/utils'

type Props = {
  coin: ZoraCoinFragment
}

const BASESCAN_BY_CHAIN: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
}

const UNISWAP_CHAIN_SLUG: Record<number, string> = {
  8453: 'base',
  84532: 'base_sepolia',
}

const ZORA_COIN_URL_BY_CHAIN: Record<number, (addr: string) => string> = {
  8453: (addr) => `https://zora.co/coin/base:${addr}`,
}

export function CoinDetail({ coin }: Props) {
  const { data: metadata } = useSWR(
    coin.uri ? (['zora-coin-metadata', coin.uri] as const) : null,
    async ([, uri]) => fetchIpfsMetadata(uri)
  )

  const rawImage = metadata?.image ?? metadata?.imageUrl ?? null
  const image = rawImage ? resolveIpfs(rawImage) : null
  const animation = metadata?.animation_url ? resolveIpfs(metadata.animation_url) : null

  const chainId = daoConfig.chainId
  const baseScan = BASESCAN_BY_CHAIN[chainId]
  const uniswapSlug = UNISWAP_CHAIN_SLUG[chainId]
  const zoraUrl = ZORA_COIN_URL_BY_CHAIN[chainId]?.(coin.coinAddress)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[3fr_2fr] lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          {animation ? (
            <video
              src={animation}
              poster={image ?? undefined}
              controls
              playsInline
              className="aspect-square w-full bg-black object-contain"
            />
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={coin.name ?? 'Coin image'}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-muted-fg">
              <ImageIcon className="h-14 w-14" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
              Zora content coin
            </div>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {coin.name ?? 'Untitled coin'}
            </h1>
            <div className="mt-1 font-mono text-lg text-muted-fg">
              {coin.symbol ? `$${coin.symbol}` : ''}
            </div>
            {metadata?.description && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-fg">
                {metadata.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            <FieldRow label="Creator">
              <ActorIdentity address={coin.caller} size={24} />
            </FieldRow>
            <FieldRow label="Paired with">
              <span className="font-mono">{shortAddress(coin.currency)}</span>
            </FieldRow>
            <FieldRow label="Created">
              <span>{formatTimeAgo(Number(coin.createdAt))}</span>
            </FieldRow>
            {coin.poolFee != null && (
              <FieldRow label="Pool fee">
                <span>
                  {Number(coin.poolFee) === DYNAMIC_FEE_FLAG
                    ? 'Dynamic'
                    : `${(Number(coin.poolFee) / 10000).toFixed(2)}%`}
                </span>
              </FieldRow>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            <CopyRow label="Coin address" value={coin.coinAddress} />
            <CopyRow label="Metadata URI" value={coin.uri ?? ''} />
            {coin.transactionHash && (
              <CopyRow label="Deploy tx" value={coin.transactionHash} />
            )}
          </div>

          <CoinTradeWidget
            coinAddress={coin.coinAddress}
            coinSymbol={coin.symbol ?? null}
          />

          <div className="flex flex-wrap items-center gap-2">
            {zoraUrl && (
              <a href={zoraUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="primary" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  View on Zora
                </Button>
              </a>
            )}
            {uniswapSlug && (
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${coin.coinAddress}&chain=${uniswapSlug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="outline" size="sm">
                  <ArrowLeftRight className="h-4 w-4" />
                  Swap on Uniswap
                </Button>
              </a>
            )}
            {baseScan && (
              <a
                href={`${baseScan}/token/${coin.coinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  BaseScan
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
