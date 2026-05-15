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
 * Round avatar that prefers the ENS / Basenames avatar and falls back to
 * a deterministic per-address gradient (Builder's `bgForAddress`).
 *
 * No image element when there's no ENS avatar — `bgForAddress` returns a
 * pure gradient string, which we paint directly on the wrapper.
 */
export function FeedAvatar({ address, size = 24, className }: FeedAvatarProps) {
  const { ensAvatar } = useEnsData(address)
  const background = bgForAddress(address, ensAvatar ?? null)

  return (
    <span
      className={cn('inline-block shrink-0 rounded-full bg-cover bg-center', className)}
      style={{ background, width: size, height: size }}
      aria-hidden
    />
  )
}
