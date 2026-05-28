'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { BidForm } from '@/components/dao/BidForm'
import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { cn, resolveIpfs } from '@/lib/utils'

import { AuctionArt } from './AuctionArt'
import { SettleAuctionAction } from './SettleAuctionAction'

export type AuctionHeroBid = {
  id: string
  amountEth: string
  bidder: string
  bidderShort: string
  comment: string | null
}

type Auction = {
  tokenId: number
  name: string
  image: string | null
  endTimeUnix: number
  topBidEth: string | null
  bidderShort: string | null
  /** Unix seconds — used to render "BORN [date]" on the hero. */
  startTimeUnix?: number
  /**
   * 'live' = the latest auction (bid form when running, settle button when
   * ended). 'past' = a settled historical token the user selected from the
   * strip; renders winner info only, no actions. Defaults to 'live'.
   */
  kind?: 'live' | 'past'
  /** Recent bids for this auction (newest first). Only populated for the
   *  live token — past tiles collapse to just their winning bid. */
  recentBids?: AuctionHeroBid[]
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

export type TintResult = { rgb: string; isLight: boolean } | null

/**
 * Builder DAOs render their token art via `nouns.build/api/renderer/stack-images`,
 * which composes the layers server-side and returns a *lossy webp*. Sampling
 * that gives an approximate color — never the exact bg.
 *
 * The first `images=ipfs://…/0-backgrounds/N.png` query param IS the
 * lossless flat-fill background layer. Sampling that gives the exact color.
 * For non-Builder renderers, fall back to the composite image.
 */
function deriveBgLayerUrl(imageUrl: string): string | null {
  try {
    const u = new URL(imageUrl)
    if (!/(^|\.)nouns\.build$/.test(u.hostname)) return null
    const images = u.searchParams.getAll('images')
    const bg = images.find((i) => i.includes('/0-backgrounds/'))
    if (!bg) return null
    if (bg.startsWith('ipfs://')) {
      return `https://gateway.pinata.cloud/ipfs/${bg.slice('ipfs://'.length)}`
    }
    return bg
  } catch {
    return null
  }
}

/**
 * WCAG relative luminance — used to decide whether the hero info column
 * should render dark text (light tint) or light text (dark tint).
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const norm = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2]
}

/**
 * Resolves a tint color for the hero. Routes the image through `/api/img-proxy`
 * so the canvas stays clean (most DAO image hosts don't send CORS headers),
 * prefers the lossless bg layer over the composite when one is detectable,
 * and returns both the rgb string and a luminance-derived `isLight` flag.
 */
function useDominantColor(imageSrc: string | null): TintResult {
  const [tint, setTint] = useState<TintResult>(null)

  useEffect(() => {
    if (!imageSrc) {
      // State-sync reset when the image source disappears (e.g. between
      // auctions). Lint rule flags any synchronous setState in an effect;
      // this one is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTint(null)
      return
    }
    let cancelled = false
    // Prefer the lossless bg layer when we can find it.
    const directSrc = deriveBgLayerUrl(imageSrc) ?? imageSrc
    const proxied = `/api/img-proxy?url=${encodeURIComponent(directSrc)}`

    const img = new Image()
    // Same-origin proxy hands back an `access-control-allow-origin: *` header,
    // so the canvas stays clean and getImageData succeeds.
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        // Downscaling to 1×1 averages the image. For the flat-fill bg layer
        // this is the exact color; for a composite it's a usable average.
        ctx.drawImage(img, 0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        if (a < 200) return
        if (cancelled) return
        setTint({
          rgb: `rgb(${r}, ${g}, ${b})`,
          isLight: relativeLuminance(r, g, b) > 0.5,
        })
      } catch {
        // Canvas tainted / CORS — leave fallback in place.
      }
    }
    img.onerror = () => {
      // Silent — fall back to neutral.
    }
    img.src = proxied
    return () => {
      cancelled = true
    }
  }, [imageSrc])

  return tint
}

function formatBornDate(unixSeconds: number | undefined): string | null {
  if (!unixSeconds) return null
  const d = new Date(unixSeconds * 1000)
  return d
    .toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    .toUpperCase()
}

export function AuctionHero({ auction, palette, tokenLabel }: Props) {
  const secs = useCountdown(auction?.endTimeUnix ?? 0)
  const ended = secs <= 0
  const critical = !ended && secs < 300
  const urgent = !ended && secs >= 300 && secs < 3600

  const imageSrc = auction?.image ? resolveIpfs(auction.image) : null
  const tint = useDominantColor(imageSrc)

  if (!auction) {
    return (
      <section className="flex min-h-[200px] items-center justify-center border border-dashed border-border bg-surface px-6 py-16 text-center">
        <div>
          <p className="text-lg font-semibold text-fg">No active auction</p>
          <p className="mt-1 text-sm text-muted-fg">
            Auctions run daily — check back soon.
          </p>
        </div>
      </section>
    )
  }

  const isPast = auction.kind === 'past'
  const topBid = auction.topBidEth ? `${trimBid(auction.topBidEth)} ETH` : '—'
  const tokenName = auction.name || `${tokenLabel} #${auction.tokenId}`
  const bornLabel = formatBornDate(auction.startTimeUnix)

  // Whole hero is a single flat color (like nouns.game) — both the artwork
  // column and the info column sit on the exact sampled bg. No gradient, no
  // backdrop on the info column.
  const tintRgb = tint?.rgb ?? null
  const tintIsLight = tint?.isLight ?? true
  const heroStyle = tintRgb ? { background: tintRgb } : undefined

  const topBidNumeric = auction.topBidEth ? parseFloat(auction.topBidEth) : 0

  // Strict black/white/gray palette per nouns.game's hero: primary text is
  // pure black on light tints and pure white on dark tints; secondary is a
  // single neutral gray for both. No hue cast.
  const textColor = tintIsLight ? 'text-black' : 'text-white'
  const mutedColor = tintIsLight ? 'text-neutral-600' : 'text-neutral-300'
  const subtleColor = tintIsLight ? 'text-neutral-700' : 'text-neutral-200'
  const dividerColor = tintIsLight ? 'border-black/15' : 'border-white/20'

  return (
    <section
      className={cn(
        'overflow-hidden transition-[background] duration-500',
        tintRgb ? '' : 'bg-surface'
      )}
      style={heroStyle}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:min-h-[560px]">
        {/* Artwork — visually dominant column, full-bleed and centered */}
        <Link
          href={`/auction/${auction.tokenId}`}
          className="group relative block aspect-square overflow-hidden md:aspect-auto"
          tabIndex={-1}
          aria-label={`View auction for ${tokenName}`}
        >
          {imageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageSrc}
              alt={tokenName}
              // `object-bottom` anchors the character's feet to the bottom of
              // the column so the figure looks grounded (nouns.game style).
              // Padding intentionally drops on the bottom edge.
              className="absolute inset-0 z-10 h-full w-full object-contain object-bottom px-4 pt-4 transition-transform duration-700 group-hover:scale-[1.02] md:px-8 md:pt-8"
            />
          ) : (
            <AuctionArt palette={palette} className="absolute inset-0" />
          )}
        </Link>

        {/* Info panel — no backdrop, sits on the same tint */}
        <div className={cn('flex flex-col px-6 py-6 md:px-8 md:py-8', textColor)}>
          <div className="flex flex-col gap-4">
            {bornLabel && (
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.18em]',
                  mutedColor
                )}
              >
                Born {bornLabel}
              </p>
            )}

            <Link href={`/auction/${auction.tokenId}`} className="group/title">
              <h1
                className={cn(
                  'font-display text-[clamp(28px,3.6vw,44px)] font-extrabold leading-[1.02] tracking-[-0.03em] transition-opacity group-hover/title:opacity-80',
                  textColor
                )}
              >
                {tokenName}
              </h1>
            </Link>

            {/* Current bid + Ends in — side-by-side, no border divider */}
            <div className="mt-1 grid grid-cols-2 gap-6">
              <div>
                <p
                  className={cn(
                    'mb-1 text-[10px] font-semibold uppercase tracking-wider',
                    mutedColor
                  )}
                >
                  {isPast || ended ? 'Top bid' : 'Current bid'}
                </p>
                <p
                  className={cn(
                    'font-display text-[clamp(18px,2vw,24px)] font-extrabold leading-none tracking-[-0.02em] tabular-nums',
                    textColor
                  )}
                >
                  {topBid}
                </p>
              </div>
              <div>
                <p
                  className={cn(
                    'mb-1 text-[10px] font-semibold uppercase tracking-wider',
                    mutedColor
                  )}
                >
                  {isPast ? 'Winner' : ended ? 'Status' : 'Ends in'}
                </p>
                {isPast ? (
                  <p
                    className={cn(
                      'font-display text-[clamp(18px,2vw,24px)] font-extrabold leading-none tracking-[-0.02em]',
                      auction.bidderShort?.startsWith('0x') ? 'font-mono' : '',
                      textColor
                    )}
                  >
                    {auction.bidderShort ?? '—'}
                  </p>
                ) : ended ? (
                  // Live slot that's past its endTime — surface the "needs to
                  // be settled" state explicitly so it doesn't read the same
                  // as a still-running auction.
                  <p
                    className={cn(
                      'font-display text-[clamp(18px,2vw,24px)] font-extrabold leading-none tracking-[-0.02em]',
                      tintIsLight ? 'text-amber-700' : 'text-amber-300'
                    )}
                  >
                    To settle
                  </p>
                ) : (
                  <p
                    className={cn(
                      'font-display text-[clamp(28px,3.4vw,42px)] font-extrabold leading-none tracking-[-0.02em] tabular-nums',
                      critical
                        ? tintIsLight
                          ? 'text-red-700'
                          : 'text-red-300'
                        : urgent
                          ? tintIsLight
                            ? 'text-amber-700'
                            : 'text-amber-300'
                          : textColor
                    )}
                  >
                    {formatCountdown(secs)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bid form / settle button only on the live auction. Past tokens
           * collapse to just the secondary link row. Sits right under the
           * title/bid grid; the link row gets pinned to the bottom via
           * mt-auto so the form doesn't get pushed away from the title. */}
          {!isPast && (
            <div className="mt-4 flex flex-col gap-3">
              {ended ? (
                <SettleAuctionAction tokenId={auction.tokenId} />
              ) : (
                <BidForm
                  tokenId={auction.tokenId}
                  topBid={topBidNumeric}
                  enableComment
                  compact
                />
              )}
            </div>
          )}

          {!isPast && auction.recentBids && auction.recentBids.length > 0 && (
            <div className="mt-5 flex flex-col gap-2.5">
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.18em]',
                  mutedColor
                )}
              >
                Recent bids
              </p>
              <ul className="flex flex-col gap-2">
                {auction.recentBids.slice(0, 3).map((b) => (
                  <li key={b.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <ActorIdentity
                        address={b.bidder}
                        size={20}
                        className={cn('text-[12.5px]', textColor)}
                      />
                      <span
                        className={cn(
                          'text-[13px] font-semibold tabular-nums',
                          textColor
                        )}
                      >
                        {trimBid(b.amountEth)} ETH
                      </span>
                    </div>
                    {b.comment && (
                      <p
                        className={cn(
                          'pl-[26px] text-[12px] italic leading-snug',
                          subtleColor
                        )}
                      >
                        &ldquo;{b.comment}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={cn(
              'mt-auto flex items-center gap-5 border-t pt-4 text-[11px] font-semibold uppercase tracking-[0.16em]',
              isPast ? 'pt-6' : 'mt-6',
              dividerColor,
              mutedColor
            )}
          >
            <Link
              href={`/auction/${auction.tokenId}`}
              className={cn(
                'inline-flex items-center gap-1 transition-colors hover:opacity-80',
                subtleColor
              )}
            >
              View auction
              <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
