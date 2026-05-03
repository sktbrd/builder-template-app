'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn, resolveIpfs } from '@/lib/utils'

import { AuctionArt } from './AuctionArt'
import { SettleAuctionAction } from './SettleAuctionAction'

type Auction = {
  tokenId: number
  name: string
  image: string | null
  endTimeUnix: number
  topBidEth: string | null
  bidderShort: string | null
}

type Props = {
  auction: Auction | null
  palette: [string, string, string]
  tokenLabel: string
}

function useCountdown(endTimeUnix: number) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, endTimeUnix - Math.floor(Date.now() / 1000))
  )
  useEffect(() => {
    const id = setInterval(
      () => setSecs(Math.max(0, endTimeUnix - Math.floor(Date.now() / 1000))),
      1000
    )
    return () => clearInterval(id)
  }, [endTimeUnix])
  return secs
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return 'Ended'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
}

function trimBid(eth: string): string {
  const [i, d = ''] = eth.split('.')
  const trimmed = d.slice(0, 4).replace(/0+$/, '')
  return trimmed ? `${i}.${trimmed}` : i
}

export function AuctionHero({ auction, palette, tokenLabel }: Props) {
  const secs = useCountdown(auction?.endTimeUnix ?? 0)
  const ended = secs <= 0
  const critical = !ended && secs < 300
  const urgent = !ended && secs >= 300 && secs < 3600

  if (!auction) {
    return (
      <section className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <div>
          <p className="text-lg font-semibold text-fg">No active auction</p>
          <p className="mt-1 text-sm text-muted-fg">
            Auctions run daily — check back soon.
          </p>
        </div>
      </section>
    )
  }

  const imageSrc = auction.image ? resolveIpfs(auction.image) : null
  const topBid = auction.topBidEth ? `${trimBid(auction.topBidEth)} ETH` : 'No bids yet'
  const tokenName = auction.name || `${tokenLabel} #${auction.tokenId}`

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* min-h on the grid so both cells have a resolved height for h-full children */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:min-h-[460px]">
        {/* Artwork — full-bleed, links to auction page */}
        <Link
          href={`/auction/${auction.tokenId}`}
          className="group relative block aspect-square overflow-hidden md:aspect-auto"
          tabIndex={-1}
          aria-label={`View auction for ${tokenName}`}
        >
          {imageSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={tokenName}
                className="absolute inset-0 z-10 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </>
          ) : (
            <AuctionArt palette={palette} className="absolute inset-0" />
          )}
          {/* Token ID chip over image */}
          <div className="absolute bottom-3 left-3 z-20 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            #{auction.tokenId}
          </div>
        </Link>

        {/* Info panel */}
        <div className="flex flex-col justify-between px-7 py-7 md:px-10 md:py-9">
          <div className="flex flex-col gap-5">
            {/* Live / Ended badge */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  ended ? 'bg-muted-fg' : 'animate-pulse bg-success'
                )}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-fg">
                {ended ? 'Auction ended' : 'Live auction'}
              </span>
            </div>

            {/* Token name */}
            <Link href={`/auction/${auction.tokenId}`} className="group/title">
              <h1 className="font-display text-[clamp(26px,3.5vw,42px)] font-extrabold leading-[1.06] tracking-[-0.025em] text-fg transition-colors group-hover/title:text-accent-strong">
                {tokenName}
              </h1>
            </Link>

            {/* Countdown */}
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                {ended ? 'Ended' : 'Ends in'}
              </p>
              <p
                className={cn(
                  'font-display text-[clamp(36px,5vw,58px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums',
                  critical ? 'text-destructive' : urgent ? 'text-warning' : 'text-fg'
                )}
              >
                {formatCountdown(secs)}
              </p>
            </div>
          </div>

          {/* Bid info + CTAs */}
          <div className="mt-8 border-t border-border pt-6">
            <div className="mb-6 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                  Top bid
                </p>
                <p className="text-[22px] font-bold leading-tight text-fg">{topBid}</p>
              </div>
              {auction.bidderShort && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                    Leading
                  </p>
                  <p className="font-mono text-[15px] font-bold leading-tight text-fg">
                    {auction.bidderShort}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {ended ? (
                <>
                  <SettleAuctionAction tokenId={auction.tokenId} />
                  <Link
                    href={`/auction/${auction.tokenId}`}
                    className="text-center text-sm font-medium text-muted-fg transition-colors hover:text-fg"
                  >
                    View auction →
                  </Link>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="w-full text-base">
                    <Link href={`/auction/${auction.tokenId}`}>Place a bid</Link>
                  </Button>
                  <Link
                    href={`/auction/${auction.tokenId}`}
                    className="text-center text-sm font-medium text-muted-fg transition-colors hover:text-fg"
                  >
                    View auction details →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
