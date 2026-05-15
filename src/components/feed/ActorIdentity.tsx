'use client'

import { useEnsData } from '@buildeross/hooks'
import { bgForAddress } from '@buildeross/utils'

import { cn } from '@/lib/utils'

type Size = 20 | 24 | 28 | 32

export type ActorIdentityProps = {
  address: string
  size?: Size
  className?: string
}

/**
 * Avatar + display name (ENS / Basenames / short-address fallback).
 *
 * Calls `useEnsData` once; SWR dedupes across siblings so multiple cards
 * for the same actor share the resolved name + avatar.
 */
export function ActorIdentity({ address, size = 24, className }: ActorIdentityProps) {
  const { ensAvatar, displayName } = useEnsData(address)
  const background = bgForAddress(address, ensAvatar ?? null)

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg',
        className
      )}
    >
      <span
        className="relative inline-block shrink-0 overflow-hidden rounded-full"
        style={{ background, width: size, height: size }}
        aria-hidden
      >
        {ensAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- ENS avatars
          // come from arbitrary hosts (ipfs gateways, arweave, http) — not
          // worth whitelisting them all in next.config.
          <img
            src={ensAvatar}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : null}
      </span>
      <span className="truncate">{displayName || shortAddress(address)}</span>
    </span>
  )
}

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
