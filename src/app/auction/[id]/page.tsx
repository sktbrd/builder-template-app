import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AuctionArt } from '@/components/dao/AuctionArt'
import { AuctionPoller } from '@/components/dao/AuctionPoller'
import { AuctionPriceChart } from '@/components/dao/AuctionPriceChart'
import { BidForm } from '@/components/dao/BidForm'
import { BidHistory } from '@/components/dao/BidHistory'
import { SettleAuctionAction } from '@/components/dao/SettleAuctionAction'
import { ThreeDArtCard } from '@/components/dao/ThreeDArtCard'
import { TimeAlert } from '@/components/dao/TimeAlert'
import { daoConfig, fallbackArtPalette } from '@/lib/dao.config'
import { getAuctionPageData, getAuctionPriceHistory } from '@/lib/dao-data'
import { cn } from '@/lib/utils'

export const revalidate = 30

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ view?: string }>

export default async function AuctionPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { view } = await searchParams
  const tokenId = parseInt(id, 10)
  if (!Number.isFinite(tokenId) || tokenId < 0) notFound()

  const isChartView = view === 'chart'
  const [data, chartData] = await Promise.all([
    getAuctionPageData(tokenId),
    isChartView ? getAuctionPriceHistory(365) : Promise.resolve(null),
  ])
  const tokenLabel = daoConfig.name.split(' ')[0]
  const palette = fallbackArtPalette()

  const hasOpenAuction = !!data.endTimeUnix && data.endTimeUnix > data.nowUnixSec
  const endsIn = data.endTimeUnix ? formatEndsIn(data.endTimeUnix, data.nowUnixSec) : null
  const minBidEth = data.topBidEth
    ? trimDecimals((Number(data.topBidEth) * 1.02).toFixed(6), 4)
    : null
  const topBidNum = data.topBidEth ? Number(data.topBidEth) : 0

  return (
    <div className="flex flex-col gap-6">
      <AuctionPoller active={hasOpenAuction} />
      {hasOpenAuction && endsIn && (
        <TimeAlert icon={<Clock className="h-4 w-4" />} dismissible>
          Auction for {tokenLabel} #{data.tokenId} ends in {endsIn}.
        </TimeAlert>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <Tabs tokenId={tokenId} isChartView={isChartView} />
          {isChartView && chartData ? (
            <AuctionPriceChart data={chartData} />
          ) : (
            <ThreeDArtCard>
              {data.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveIpfs(data.image)}
                  alt={data.name ?? `${tokenLabel} #${data.tokenId}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <AuctionArt palette={palette} />
              )}
            </ThreeDArtCard>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-3">
          <AuctionNav
            tokenId={data.tokenId}
            isLatest={data.isLatest}
            prevId={data.prevTokenId}
            nextId={data.nextTokenId}
            endTimeUnix={data.endTimeUnix}
          />

          <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em] break-words">
            {data.name ?? `${tokenLabel} #${data.tokenId}`}
          </h1>

          <div className="my-2 grid grid-cols-2 gap-4">
            <Kv
              label="Top bid"
              value={
                data.topBidEth ? `${trimDecimals(data.topBidEth, 4)} ETH` : 'No bids yet'
              }
            />
            <Kv
              label="Top bidder"
              value={data.bidderShort ?? '—'}
              mono={!!data.bidderShort}
            />
            <Kv
              label={hasOpenAuction ? 'Ends in' : 'Status'}
              value={hasOpenAuction ? (endsIn ?? '—') : 'Settled'}
            />
            <Kv label="Min next bid" value={minBidEth ? `${minBidEth} ETH` : '—'} />
          </div>

          {hasOpenAuction ? (
            <BidForm
              tokenId={data.tokenId}
              topBid={topBidNum}
              enableComment={daoConfig.features.bidComments}
            />
          ) : (
            <>
              <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-5 text-sm text-muted-fg">
                This auction has ended.{' '}
                {data.nextTokenId != null && (
                  <Link
                    href={`/auction/${data.nextTokenId}`}
                    className="font-semibold text-accent-strong hover:underline"
                  >
                    See next auction →
                  </Link>
                )}
              </div>
              <SettleAuctionAction tokenId={data.tokenId} />
            </>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="mb-4">
          <h2 className="text-xl font-bold tracking-tight">Bid history</h2>
        </div>
        <BidHistory
          bids={data.bids.map((b) => ({
            amount: trimDecimals(b.amountEth, 4),
            addr: b.bidderShort,
          }))}
        />
      </section>
    </div>
  )
}

function Tabs({ tokenId, isChartView }: { tokenId: number; isChartView: boolean }) {
  const activeClass =
    '-mb-px border-b-2 border-fg px-0 py-2.5 text-sm font-semibold text-fg'
  const inactiveClass =
    '-mb-px border-b-2 border-transparent px-0 py-2.5 text-sm font-semibold text-muted-fg hover:text-fg'
  return (
    <div className="mb-4 flex gap-4 border-b border-border">
      <Link
        href={`/auction/${tokenId}`}
        scroll={false}
        className={isChartView ? inactiveClass : activeClass}
        aria-current={isChartView ? undefined : 'page'}
      >
        Auction
      </Link>
      <Link
        href={`/auction/${tokenId}?view=chart`}
        scroll={false}
        className={isChartView ? activeClass : inactiveClass}
        aria-current={isChartView ? 'page' : undefined}
      >
        Chart
      </Link>
    </div>
  )
}

function AuctionNav({
  tokenId,
  isLatest,
  prevId,
  nextId,
  endTimeUnix,
}: {
  tokenId: number
  isLatest: boolean
  prevId: number | null
  nextId: number | null
  endTimeUnix: number | null
}) {
  const date = endTimeUnix
    ? new Date(endTimeUnix * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {prevId != null ? (
        <Link
          href={`/auction/${prevId}`}
          aria-label="Previous auction"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-fg hover:bg-surface-3 md:h-8 md:w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <button
          aria-label="Previous auction"
          disabled
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-fg opacity-30 md:h-8 md:w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {nextId != null ? (
        <Link
          href={`/auction/${nextId}`}
          aria-label="Next auction"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-fg hover:bg-surface-3 md:h-8 md:w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <button
          aria-label="Next auction"
          disabled
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-fg opacity-30 md:h-8 md:w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {isLatest && (
        <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
          Latest auction
        </span>
      )}
      {date && (
        <span className="ml-auto text-[12.5px] text-muted-fg">
          Token #{tokenId} · {date}
        </span>
      )}
    </div>
  )
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[12.5px] text-muted-fg">{label}</div>
      <div
        className={cn(
          'text-[17px] font-bold leading-tight text-fg',
          mono && 'font-mono text-sm'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function trimDecimals(value: string, max: number): string {
  if (!value) return value
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}

function formatEndsIn(unixSec: number, nowUnixSec: number): string {
  const diff = (unixSec - nowUnixSec) * 1000
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / (1000 * 60 * 60))
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}m`
}

function resolveIpfs(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
  }
  return uri
}
