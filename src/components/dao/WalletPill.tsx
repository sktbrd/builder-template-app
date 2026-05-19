'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md'

type Props = {
  /** Full 0x address. */
  address: string
  /** Reverse-resolved ENS or basename. Renders in place of the short addr. */
  ens?: string | null
  /** Wraps the label in a Link to /members/[address]. Default true. */
  link?: boolean
  /** Color-hashed avatar dot. */
  showAvatar?: boolean
  /** Inline copy-to-clipboard affordance. */
  showCopy?: boolean
  /** Inline block-explorer affordance. Requires chainId. */
  showExplorer?: boolean
  /** Required when showExplorer is true. */
  chainId?: number
  /** Optional 2nd line under the label (e.g. a token count). */
  meta?: React.ReactNode
  size?: Size
  className?: string
}

const SIZE_PRESETS: Record<Size, { label: string; addr: string; avatar: string }> = {
  xs: {
    label: 'text-[12.5px]',
    addr: 'text-[10.5px]',
    avatar: 'h-4 w-4',
  },
  sm: {
    label: 'text-[13px]',
    addr: 'text-[11px]',
    avatar: 'h-5 w-5',
  },
  md: {
    label: 'text-sm',
    addr: 'text-xs',
    avatar: 'h-7 w-7',
  },
}

export function WalletPill({
  address,
  ens = null,
  link = true,
  showAvatar = false,
  showCopy = false,
  showExplorer = false,
  chainId,
  meta,
  size = 'sm',
  className,
}: Props) {
  const [copied, setCopied] = useState(false)
  const preset = SIZE_PRESETS[size]
  const labelText = ens ?? short(address)
  const labelClassName = cn(
    'font-semibold text-fg',
    preset.label,
    ens ? 'font-semibold' : 'font-mono',
    link && 'group-hover:underline'
  )

  const label = link ? (
    <Link
      href={`/members/${address.toLowerCase()}`}
      className="group inline-flex min-w-0 flex-1 items-center gap-1.5"
    >
      {showAvatar && (
        <span
          className={cn('shrink-0 rounded-full', preset.avatar)}
          style={{ background: avatarColor(address) }}
          aria-hidden
        />
      )}
      <span className="min-w-0 truncate">
        <span className={labelClassName}>{labelText}</span>
        {meta != null && (
          <span className={cn('block truncate text-muted-fg', preset.addr)}>{meta}</span>
        )}
        {!meta && ens && (
          <span className={cn('block truncate font-mono text-muted-fg', preset.addr)}>
            {short(address)}
          </span>
        )}
      </span>
    </Link>
  ) : (
    <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
      {showAvatar && (
        <span
          className={cn('shrink-0 rounded-full', preset.avatar)}
          style={{ background: avatarColor(address) }}
          aria-hidden
        />
      )}
      <span className="min-w-0 truncate">
        <span className={labelClassName}>{labelText}</span>
        {meta != null && (
          <span className={cn('block truncate text-muted-fg', preset.addr)}>{meta}</span>
        )}
        {!meta && ens && (
          <span className={cn('block truncate font-mono text-muted-fg', preset.addr)}>
            {short(address)}
          </span>
        )}
      </span>
    </span>
  )

  const hasIcons = showCopy || (showExplorer && chainId)

  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-2', className)}>
      {label}
      {hasIcons && (
        <span className="flex shrink-0 items-center gap-1">
          {showCopy && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigator.clipboard?.writeText(address)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-muted-fg transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Copy address"
              title="Copy address"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {showExplorer && chainId && (
            <a
              href={explorerUrl(chainId, address)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-muted-fg transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="View on block explorer"
              title="View on block explorer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </span>
      )}
    </span>
  )
}

function short(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function avatarColor(addr: string): string {
  const seed = Number.parseInt(addr.slice(2, 8), 16) || 0
  return `oklch(0.7 0.15 ${seed % 360})`
}

function explorerUrl(chainId: number, addr: string): string {
  const base =
    {
      1: 'https://etherscan.io',
      10: 'https://optimistic.etherscan.io',
      8453: 'https://basescan.org',
      7777777: 'https://explorer.zora.energy',
    }[chainId] ?? 'https://basescan.org'
  return `${base}/address/${addr}`
}
