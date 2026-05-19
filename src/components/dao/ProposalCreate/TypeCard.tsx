'use client'

import { Coins, Send, Settings2 } from 'lucide-react'

import type { TxKind } from '@/lib/proposal-tx'
import { cn } from '@/lib/utils'

const KIND_META: Record<
  TxKind,
  {
    icon: typeof Send
    label: string
    description: string
    iconClass: string
  }
> = {
  eth: {
    icon: Send,
    label: 'Send ETH',
    description: 'Transfer ETH from the treasury to a wallet.',
    iconClass: 'bg-accent/15 text-accent-strong',
  },
  erc20: {
    icon: Coins,
    label: 'Send ERC-20',
    description: 'Transfer USDC, WETH, or any other ERC-20 token.',
    iconClass: 'bg-success/15 text-success',
  },
  custom: {
    icon: Settings2,
    label: 'Custom call',
    description: 'Hand-rolled target, value, and calldata for any contract call.',
    iconClass: 'bg-muted-fg/15 text-muted-fg',
  },
}

type Props = {
  kind: TxKind
  onSelect: () => void
}

export function TypeCard({ kind, onSelect }: Props) {
  const meta = KIND_META[kind]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-left transition-[border-color,transform] hover:-translate-y-px hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          meta.iconClass
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-fg group-hover:text-accent-strong">
          {meta.label}
        </span>
        <span className="mt-0.5 text-[12.5px] text-muted-fg">{meta.description}</span>
      </span>
    </button>
  )
}
