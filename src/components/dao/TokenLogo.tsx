'use client'

import { getAddress } from 'viem'

import { cn } from '@/lib/utils'

const TW_CHAIN: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  8453: 'base',
  7777777: 'zora',
}

function trustWalletUrl(chainId: number, address: string): string | null {
  const chain = TW_CHAIN[chainId]
  if (!chain) return null
  try {
    const checksummed = getAddress(address)
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksummed}/logo.png`
  } catch {
    return null
  }
}

// ETH native token logo from Trust Wallet
const ETH_LOGO =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'

type Props = {
  /** Contract address. Pass undefined / empty string for the native ETH token. */
  address?: string
  symbol: string
  chainId: number
  size?: number
  className?: string
}

export function TokenLogo({ address, symbol, chainId, size = 24, className }: Props) {
  const src = address ? trustWalletUrl(chainId, address) : ETH_LOGO
  const fallback = symbol.slice(0, 1).toUpperCase()

  if (!src) {
    return <LetterFallback letter={fallback} size={size} className={className} />
  }

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3',
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={(e) => {
          const img = e.currentTarget
          img.style.display = 'none'
          const parent = img.parentElement
          if (parent) {
            parent.textContent = fallback
            parent.classList.add('text-xs', 'font-bold')
          }
        }}
      />
    </span>
  )
}

function LetterFallback({
  letter,
  size,
  className,
}: {
  letter: string
  size: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold',
        className
      )}
      style={{ width: size, height: size }}
    >
      {letter}
    </span>
  )
}
