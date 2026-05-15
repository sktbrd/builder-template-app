'use client'

import { WETH_ADDRESS } from '@buildeross/constants'
import { type ClankerTokenFragment } from '@buildeross/sdk/subgraph'
import { formatTimeAgo } from '@buildeross/utils'
import {
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react'
import { useState } from 'react'
import { isAddressEqual } from 'viem'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { resolveIpfs } from '@/lib/utils'

type Props = {
  coin: ClankerTokenFragment
}

const BASESCAN_BY_CHAIN: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
}

const UNISWAP_CHAIN_SLUG: Record<number, string> = {
  8453: 'base',
  84532: 'base_sepolia',
}

export function CoinDetail({ coin }: Props) {
  const image = coin.tokenImage ? resolveIpfs(coin.tokenImage) : null
  const chainId = daoConfig.chainId
  const baseScan = BASESCAN_BY_CHAIN[chainId]
  const uniswapSlug = UNISWAP_CHAIN_SLUG[chainId]
  const wethAddress = WETH_ADDRESS[chainId as keyof typeof WETH_ADDRESS]
  const pairedIsWeth =
    !!wethAddress && isAddressEqual(coin.pairedToken as `0x${string}`, wethAddress)
  const pairedLabel = pairedIsWeth ? 'WETH' : shortAddress(coin.pairedToken)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={coin.tokenName ?? 'Coin image'}
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
              Clanker coin
            </div>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {coin.tokenName ?? 'Untitled coin'}
            </h1>
            <div className="mt-1 font-mono text-lg text-muted-fg">
              {coin.tokenSymbol ? `$${coin.tokenSymbol}` : ''}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            <FieldRow label="Deployer">
              <ActorIdentity address={coin.msgSender} size={24} />
            </FieldRow>
            <FieldRow label="Paired with">
              <span className="font-mono">{pairedLabel}</span>
            </FieldRow>
            <FieldRow label="Created">
              <span>{formatTimeAgo(Number(coin.createdAt))}</span>
            </FieldRow>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            <CopyRow label="Token address" value={coin.tokenAddress} />
            <CopyRow label="Pool id" value={coin.poolId} />
            {coin.transactionHash && (
              <CopyRow label="Deploy tx" value={coin.transactionHash} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://clanker.world/clanker/${coin.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" variant="primary" size="sm">
                <ExternalLink className="h-4 w-4" />
                View on clanker.world
              </Button>
            </a>
            {uniswapSlug && (
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${coin.tokenAddress}&chain=${uniswapSlug}`}
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
                href={`${baseScan}/token/${coin.tokenAddress}`}
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] uppercase tracking-wider text-muted-fg">{label}</span>
      <div className="min-w-0 truncate text-right">{children}</div>
    </div>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[12px] uppercase tracking-wider text-muted-fg">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-[12.5px]">{value}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            } catch {
              // ignore
            }
          }}
          className="shrink-0 rounded-md p-1 text-muted-fg transition-colors hover:bg-surface hover:text-fg"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
