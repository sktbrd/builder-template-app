'use client'

import { formatTimeAgo } from '@buildeross/utils'
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react'

import { CopyRow, FieldRow } from '@/components/coins/detail-rows'
import { DroposalMintWidget } from '@/components/coins/DroposalMintWidget'
import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { type DroposalDetailData } from '@/lib/droposals'

type Props = {
  data: DroposalDetailData
}

const BASESCAN_BY_CHAIN: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
}

const STATUS_LABELS: Record<DroposalDetailData['status'], string> = {
  executed: 'Executed',
  queued: 'Queued',
  active: 'Active',
  pending: 'Pending',
  defeated: 'Defeated',
  canceled: 'Canceled',
  vetoed: 'Vetoed',
  expired: 'Expired',
}

function priceLabel(priceEth: string): string {
  return priceEth === '0' || priceEth === '0.0' ? 'Free' : `${priceEth} ETH`
}

export function DroposalDetail({ data }: Props) {
  const chainId = daoConfig.chainId
  const baseScan = BASESCAN_BY_CHAIN[chainId]
  const zoraUrl =
    chainId === 8453 && data.dropAddress
      ? `https://zora.co/collect/base:${data.dropAddress}`
      : null

  const saleWindow =
    data.saleStartMs || data.saleEndMs
      ? `${data.saleStartMs ? new Date(data.saleStartMs).toLocaleDateString() : 'Now'} → ${
          data.saleEndMs ? new Date(data.saleEndMs).toLocaleDateString() : 'No end'
        }`
      : 'Not set'

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[3fr_2fr] lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          {data.animationUrl ? (
            <video
              src={data.animationUrl}
              poster={data.image ?? undefined}
              controls
              playsInline
              className="aspect-square w-full bg-black object-contain"
            />
          ) : data.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.image}
              alt={data.name || data.title}
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
              Zora edition · Droposal
            </div>
            <h1 className="mt-1 text-3xl font-bold leading-tight">
              {data.name || data.title}
            </h1>
            <div className="mt-1 font-mono text-lg text-muted-fg">
              {data.symbol ? `$${data.symbol}` : ''}
            </div>
            {data.description && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-fg">
                {data.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            <FieldRow label="Funds recipient">
              <ActorIdentity address={data.fundsRecipient} size={24} />
            </FieldRow>
            <FieldRow label="Edition size">
              <span>
                {data.isOpenEdition
                  ? 'Open edition'
                  : new Intl.NumberFormat().format(Number(data.editionSize))}
              </span>
            </FieldRow>
            <FieldRow label="Price">
              <span>{priceLabel(data.priceEth)}</span>
            </FieldRow>
            <FieldRow label="Royalty">
              <span>{(data.royaltyBps / 100).toFixed(2)}%</span>
            </FieldRow>
            <FieldRow label="Sale window">
              <span>{saleWindow}</span>
            </FieldRow>
            <FieldRow label="Created">
              <span>{formatTimeAgo(Math.floor(data.createdAtMs / 1000))}</span>
            </FieldRow>
            <FieldRow label="Status">
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                {STATUS_LABELS[data.status]}
              </span>
            </FieldRow>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm">
            {data.dropAddress && (
              <CopyRow label="Drop contract" value={data.dropAddress} />
            )}
            <CopyRow label="Admin" value={data.defaultAdmin} />
            {data.executionTransactionHash && (
              <CopyRow label="Execution tx" value={data.executionTransactionHash} />
            )}
          </div>

          <DroposalMintWidget dropAddress={data.dropAddress} priceEth={data.priceEth} />

          <div className="flex flex-wrap items-center gap-2">
            {zoraUrl && (
              <a href={zoraUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="primary" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  Collect on Zora
                </Button>
              </a>
            )}
            {baseScan && data.dropAddress && (
              <a
                href={`${baseScan}/token/${data.dropAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                  BaseScan
                </Button>
              </a>
            )}
            <a href={`/proposals/${data.proposalNumber}`}>
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" />
                View proposal #{data.proposalNumber}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
