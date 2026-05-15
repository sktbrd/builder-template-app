'use client'

import { useEnsData } from '@buildeross/hooks'
import { bgForAddress } from '@buildeross/utils'

import { cn } from '@/lib/utils'

type Size = 20 | 24 | 28 | 32 | 40

export type FeedAvatarProps = {
  address: string
  size?: Size
  className?: string
}

/**
 * Round avatar with ENS / Basenames image when available, gradient fallback
 * otherwise. Mirrors `@buildeross/ui` Avatar: `bgForAddress(addr, src)` paints
 * the placeholder behind an `<img>` so the gradient still shows during load
 * and if the image 404s.
 */
export function FeedAvatar({ address, size = 24, className }: FeedAvatarProps) {
  const { ensAvatar } = useEnsData(address)
  const background = bgForAddress(address, ensAvatar ?? null)

  return (
    <span
      className={cn(
        'relative inline-block shrink-0 overflow-hidden rounded-full',
        className
      )}
      style={{ background, width: size, height: size }}
      aria-hidden
    >
      {ensAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- ENS avatars
        // resolve to arbitrary URLs (ipfs gateways, arweave, http hosts);
        // whitelisting every host in next.config is impractical.
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
  )
}
