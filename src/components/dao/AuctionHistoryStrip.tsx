'use client'

import Link from 'next/link'

import type { RecentTokenSummary } from '@/lib/dao-data'
import { cn, resolveIpfs } from '@/lib/utils'

type Props = {
  tokens: RecentTokenSummary[]
  /** Total minted, surfaced so the "View all" link can label the size. */
  totalSupply: number
  /**
   * Which token is currently shown in the hero. When provided, the matching
   * tile renders selected. Tiles become buttons that call `onSelect` instead
   * of navigating away — the strip drives in-place preview.
   */
  selectedTokenId?: number
  onSelect?: (tokenId: number) => void
  /**
   * End time (unix seconds) of the live auction. When it's in the past, the
   * live tile flips to a "to settle" status — the auction has ended onchain
   * but hasn't been settled yet, which is a meaningfully different state
   * from a normal live/bidding tile.
   */
  liveEndTimeUnix?: number
}

export function AuctionHistoryStrip({
  tokens,
  totalSupply,
  selectedTokenId,
  onSelect,
  liveEndTimeUnix,
}: Props) {
  if (tokens.length === 0) return null

  // Marquee needs the list duplicated end-to-end so the -50% translate loops
  // seamlessly. Render once and reuse with aria-hidden on the clone.
  const items = (
    <ul className="flex shrink-0 items-stretch gap-2">
      {tokens.map((t) => (
        <li key={t.tokenId} className="shrink-0">
          <TokenTile
            token={t}
            isSelected={selectedTokenId === t.tokenId}
            onSelect={onSelect}
            liveEndTimeUnix={liveEndTimeUnix}
          />
        </li>
      ))}
      {totalSupply > tokens.length && (
        <li className="flex shrink-0 items-center">
          <Link
            href="/auction/latest"
            className="flex h-[92px] w-[88px] flex-col items-center justify-center gap-0.5 rounded-[6px] border border-dashed border-border bg-surface/30 text-center text-[11px] font-semibold text-muted-fg transition-colors hover:border-border-strong hover:text-fg"
          >
            View
            <br />
            all
            <span aria-hidden className="text-[10px] text-muted-fg/70">
              {totalSupply.toLocaleString('en-US')}
            </span>
          </Link>
        </li>
      )}
    </ul>
  )

  return (
    <section aria-label="Recent auctions" className="group/marquee overflow-hidden">
      <div className="flex w-max gap-2 animate-[marquee_60s_linear_infinite] group-hover/marquee:[animation-play-state:paused]">
        {items}
        <div aria-hidden>{items}</div>
      </div>
    </section>
  )
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const BURN_ADDR = '0x000000000000000000000000000000000000dead'

type TileStatus =
  | { kind: 'live' }
  | { kind: 'settling' }
  | { kind: 'treasury' }
  | { kind: 'burned' }
  | { kind: 'owned'; label: string }

function classifyToken(token: RecentTokenSummary, liveEndTimeUnix?: number): TileStatus {
  if (token.isLive) {
    // The live slot has two sub-states: still accepting bids vs ended and
    // waiting for `settle` to be called. The Builder contract treats the
    // second as "ended" onchain but the auction is still the current one
    // until someone settles it.
    const now = Math.floor(Date.now() / 1000)
    if (liveEndTimeUnix && liveEndTimeUnix > 0 && now >= liveEndTimeUnix) {
      return { kind: 'settling' }
    }
    return { kind: 'live' }
  }
  if (token.ownerLabel === 'Treasury') return { kind: 'treasury' }
  const owner = token.owner.toLowerCase()
  if (owner === ZERO_ADDR || owner === BURN_ADDR) return { kind: 'burned' }
  return { kind: 'owned', label: token.ownerLabel }
}

function TokenTile({
  token,
  isSelected,
  onSelect,
  liveEndTimeUnix,
}: {
  token: RecentTokenSummary
  isSelected: boolean
  onSelect?: (tokenId: number) => void
  liveEndTimeUnix?: number
}) {
  const imageSrc = token.image ? resolveIpfs(token.image) : null
  const status = classifyToken(token, liveEndTimeUnix)
  const ariaLabel =
    status.kind === 'live'
      ? `Show auction #${token.tokenId} (live, accepting bids)`
      : status.kind === 'settling'
        ? `Show auction #${token.tokenId} (awaiting settlement)`
        : status.kind === 'treasury'
          ? `Show auction #${token.tokenId} — held by treasury`
          : status.kind === 'burned'
            ? `Show auction #${token.tokenId} — burned`
            : `Show auction #${token.tokenId} — owned by ${status.label}`

  // Live tile uses the accent ring; "settling" uses warning so it reads
  // distinct from a normal live auction. Non-live selected tile shows a
  // neutral ring so the selected-state and the live-state stay distinguishable.
  const liveishRing =
    status.kind === 'live'
      ? 'border-accent ring-2 ring-accent/30'
      : status.kind === 'settling'
        ? 'border-warning ring-2 ring-warning/30'
        : null
  const ringClass = isSelected
    ? (liveishRing ?? 'border-fg ring-2 ring-fg/30')
    : (liveishRing ?? 'border-border')

  return (
    <button
      type="button"
      onClick={() => onSelect?.(token.tokenId)}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[6px] border bg-surface transition-colors hover:border-border-strong',
        ringClass
      )}
    >
      <div className="relative h-[60px] w-[88px] overflow-hidden bg-surface-2">
        {imageSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            className={cn(
              'h-full w-full object-cover',
              status.kind === 'burned' && 'grayscale opacity-60'
            )}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-surface-2 to-surface-3" />
        )}
        {status.kind === 'live' && (
          <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-fg">
            Live
          </span>
        )}
        {status.kind === 'settling' && (
          <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-warning px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            Settle
          </span>
        )}
      </div>
      <div className="flex flex-col px-2 pb-1.5 pt-1 text-left">
        <span className="text-[12px] font-bold leading-tight text-fg">
          #{token.tokenId}
        </span>
        <StatusLine status={status} />
      </div>
    </button>
  )
}

function StatusLine({ status }: { status: TileStatus }) {
  if (status.kind === 'live') {
    return (
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-accent-strong">
        Live
      </span>
    )
  }
  if (status.kind === 'settling') {
    return (
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-warning">
        To settle
      </span>
    )
  }
  if (status.kind === 'treasury') {
    return (
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-accent-strong">
        Treasury
      </span>
    )
  }
  if (status.kind === 'burned') {
    return (
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
        Burned
      </span>
    )
  }
  return (
    <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-fg/80">
      {status.label}
    </span>
  )
}
