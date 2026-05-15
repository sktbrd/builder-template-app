import {
  ArrowUpRight,
  Check,
  Coins,
  Gavel,
  MessageSquareText,
  Minus,
  type LucideIcon,
  ThumbsDown,
  ThumbsUp,
  Vote,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'

// ── Vote support badge ────────────────────────────────────────

const SUPPORT_CONFIG = {
  FOR: {
    label: 'Voted for',
    icon: ThumbsUp,
    bgClass: 'bg-vote-for/15',
    textClass: 'text-vote-for',
  },
  AGAINST: {
    label: 'Voted against',
    icon: ThumbsDown,
    bgClass: 'bg-vote-against/15',
    textClass: 'text-vote-against',
  },
  ABSTAIN: {
    label: 'Abstained',
    icon: Minus,
    bgClass: 'bg-vote-abstain/20',
    textClass: 'text-vote-abstain',
  },
} as const

export type VoteSupport = keyof typeof SUPPORT_CONFIG

export function VoteSupportBadge({ support }: { support: VoteSupport }) {
  const cfg = SUPPORT_CONFIG[support]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cfg.bgClass,
        cfg.textClass
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {cfg.label}
    </span>
  )
}

// ── Event-type chip (top-right of card) ───────────────────────

export type EventCategory =
  | 'proposal'
  | 'vote'
  | 'auction'
  | 'auction-bid'
  | 'auction-settled'
  | 'coin'
  | 'executed'

const CATEGORY_CONFIG: Record<
  EventCategory,
  { label: string; icon: LucideIcon; toneClass: string }
> = {
  proposal: {
    label: 'Proposal',
    icon: MessageSquareText,
    toneClass: 'bg-warning/10 text-warning ring-1 ring-warning/30',
  },
  vote: {
    label: 'Vote',
    icon: Vote,
    toneClass: 'bg-accent/10 text-accent-strong ring-1 ring-accent/30',
  },
  auction: {
    label: 'Auction',
    icon: Gavel,
    toneClass: 'bg-accent/10 text-accent-strong ring-1 ring-accent/30',
  },
  'auction-bid': {
    label: 'Bid',
    icon: ArrowUpRight,
    toneClass: 'bg-accent/10 text-accent-strong ring-1 ring-accent/30',
  },
  'auction-settled': {
    label: 'Settled',
    icon: Check,
    toneClass: 'bg-success/10 text-success ring-1 ring-success/30',
  },
  coin: {
    label: 'Coin',
    icon: Coins,
    toneClass: 'bg-accent/10 text-accent-strong ring-1 ring-accent/30',
  },
  executed: {
    label: 'Executed',
    icon: Check,
    toneClass: 'bg-success/10 text-success ring-1 ring-success/30',
  },
}

export function EventTypeChip({ category }: { category: EventCategory }) {
  const cfg = CATEGORY_CONFIG[category]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        cfg.toneClass
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {cfg.label}
    </span>
  )
}

export { X as DismissIcon }

// ── Quote block (vote reasons + bid comments) ─────────────────

export function QuoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="mt-2 border-l-2 border-border-strong bg-surface-2/60 py-1.5 pl-3 pr-2 text-sm leading-snug text-fg-2">
      {children}
    </blockquote>
  )
}
