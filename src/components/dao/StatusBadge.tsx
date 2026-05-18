import type { ProposalStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STYLES: Record<ProposalStatus, { color: string; bg: string; label: string }> = {
  pending: {
    color: 'text-warning',
    bg: 'bg-warning/15',
    label: 'Pending',
  },
  active: {
    color: 'text-accent-strong',
    bg: 'bg-accent/15',
    label: 'Active',
  },
  cancelled: {
    color: 'text-muted-fg',
    bg: 'bg-surface-2',
    label: 'Cancelled',
  },
  defeated: {
    color: 'text-destructive',
    bg: 'bg-destructive/15',
    label: 'Defeated',
  },
  succeeded: {
    color: 'text-success',
    bg: 'bg-success/15',
    label: 'Succeeded',
  },
  queued: {
    color: 'text-accent-strong',
    bg: 'bg-accent/10',
    label: 'Queued',
  },
  expired: {
    color: 'text-muted-fg',
    bg: 'bg-surface-2',
    label: 'Expired',
  },
  executed: {
    color: 'text-success',
    bg: 'bg-success/20',
    label: 'Executed',
  },
  vetoed: {
    color: 'text-destructive',
    bg: 'bg-destructive/15',
    label: 'Vetoed',
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
