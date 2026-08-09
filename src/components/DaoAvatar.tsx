'use client'

import Image from 'next/image'
import { useState } from 'react'

import { DaoLogo } from '@/components/DaoLogo'
import { cn } from '@/lib/utils'

type Props = {
  /** IPFS URI or HTTP URL of the DAO contract image. */
  image: string | null | undefined
  /** Square pixel size. Defaults to 28. */
  size?: number
  /** Accessible label / alt text. */
  alt: string
  /** Fallback accent color used when no image is available. */
  fallbackColor: string
  className?: string
  /** Eager-load the image. Use for avatars rendered above the fold. */
  priority?: boolean
}

/**
 * Render the on-chain DAO image as a circular avatar. Falls back to the
 * stripes SVG (DaoLogo) when no image is set on the contract or when the
 * gateway request fails.
 */
export function DaoAvatar({
  image,
  size = 28,
  alt,
  fallbackColor,
  className,
  priority,
}: Props) {
  const [errored, setErrored] = useState(false)
  const url = resolveImageUrl(image)
  const showImage = !!url && !errored

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2',
        className
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          src={url}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
          unoptimized={!url.startsWith('https://gateway.pinata.cloud/')}
          priority={priority}
        />
      ) : (
        <DaoLogo style="stripes" color={fallbackColor} size={size} />
      )}
    </span>
  )
}

/**
 * Resolve an `ipfs://...` URI to an HTTP gateway URL.
 * Mirrors the simple resolver used elsewhere in the app — full multi-gateway
 * fallback (per @buildeross/ipfs-service) lands separately.
 */
function resolveImageUrl(image: string | null | undefined): string | null {
  if (!image) return null
  if (image.startsWith('ipfs://')) {
    return `https://gateway.pinata.cloud/ipfs/${image.slice(7)}`
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image
  }
  // Bare CID — assume v0/v1 CID, prepend gateway.
  return `https://gateway.pinata.cloud/ipfs/${image}`
}
