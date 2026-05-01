import type { ProposalStatus } from '@/lib/mockData'
import { cn } from '@/lib/utils'

const STYLES: Record<
  ProposalStatus,
  { color: string; bg: string; label: string }
> = {
  active: {
    color: 'text-success',
    bg: 'bg-success/15',
    label: 'Active',
  },
  pending: {
    color: 'text-success',
    bg: 'bg-success/15',
    label: 'Pending',
  },
  executed: {
    color: 'text-accent-strong',
    bg: 'bg-accent/15',
    label: 'Executed',
  },
  defeated: {
    color: 'text-destructive',
    bg: 'bg-destructive/15',
    label: 'Defeated',
  },
  cancelled: {
    color: 'text-muted-fg',
    bg: 'bg-surface-2',
    label: 'Cancelled',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProposalStatus
  className?: string
}) {
  const s = STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider',
        s.color,
        s.bg,
        className
      )}
    >
      {s.label}
    </span>
  )
}
