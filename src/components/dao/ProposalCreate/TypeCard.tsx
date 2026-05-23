'use client'

import {
  Brush,
  CircleDollarSign,
  CloudRain,
  Coins,
  Flag,
  ImageIcon,
  Layers,
  Package,
  PauseCircle,
  Pin,
  RefreshCw,
  Send,
  Settings2,
  Timer,
  UserCheck,
  Wallet,
} from 'lucide-react'

import type { TxKind } from '@/lib/proposal-tx'
import { cn } from '@/lib/utils'

const KIND_META: Record<
  TxKind | 'creator_coin',
  {
    icon: React.ElementType
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
  nft: {
    icon: ImageIcon,
    label: 'Send NFTs',
    description: 'Send NFTs from the treasury.',
    iconClass: 'bg-orange-500/15 text-orange-500',
  },
  stream: {
    icon: Timer,
    label: 'Stream Tokens',
    description: 'Continuous token payments over time.',
    iconClass: 'bg-cyan-500/15 text-cyan-500',
  },
  airdrop: {
    icon: CloudRain,
    label: 'Airdrop Tokens',
    description: 'Distribute tokens with Sablier merkle campaigns.',
    iconClass: 'bg-sky-500/15 text-sky-500',
  },
  milestone: {
    icon: Flag,
    label: 'Milestone Payments',
    description: 'Schedule token releases in milestones.',
    iconClass: 'bg-rose-500/15 text-rose-500',
  },
  mint_gov: {
    icon: Layers,
    label: 'Mint Governance Tokens',
    description: 'Mint governance tokens to selected addresses.',
    iconClass: 'bg-emerald-500/15 text-emerald-500',
  },
  walletconnect: {
    icon: Wallet,
    label: 'WalletConnect',
    description: 'Connect to dApps and execute transactions via WalletConnect.',
    iconClass: 'bg-blue-500/15 text-blue-500',
  },
  delegate: {
    icon: UserCheck,
    label: 'Nominate Delegate',
    description: 'Nominate a delegate for milestone payments or token streams.',
    iconClass: 'bg-violet-500/15 text-violet-500',
  },
  pin_asset: {
    icon: Pin,
    label: 'Pin Treasury Asset',
    description: 'Whitelist a token or NFT for prominent display in treasury.',
    iconClass: 'bg-amber-500/15 text-amber-500',
  },
  custom: {
    icon: Settings2,
    label: 'Custom Transaction',
    description: 'Any other type of transaction.',
    iconClass: 'bg-muted-fg/15 text-muted-fg',
  },
  creator_coin: {
    icon: CircleDollarSign,
    label: 'Creator Coin',
    description: 'Create a proposal to mint Creator Coin.',
    iconClass: 'bg-yellow-500/15 text-yellow-500',
  },
  droposal: {
    icon: Package,
    label: 'Droposal: Single Edition',
    description: 'Single-edition ERC721 collection droposal.',
    iconClass: 'bg-indigo-500/15 text-indigo-500',
  },
  pause_auction: {
    icon: PauseCircle,
    label: 'Pause Auctions',
    description: 'Pause or unpause the DAO auction house.',
    iconClass: 'bg-red-500/15 text-red-500',
  },
  add_artwork: {
    icon: Brush,
    label: 'Add Artwork',
    description: 'Add new artwork to your collection.',
    iconClass: 'bg-pink-500/15 text-pink-500',
  },
  replace_artwork: {
    icon: RefreshCw,
    label: 'Replace Artwork',
    description: 'Replace existing artwork in your collection.',
    iconClass: 'bg-teal-500/15 text-teal-500',
  },
}

type Props = {
  kind: TxKind | 'creator_coin'
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
