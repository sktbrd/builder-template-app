import { cn } from '@/lib/utils'

type Props = {
  active: boolean
  className?: string
}

/**
 * "Active" / "Dormant" pill — matches the StatusBadge visual language but is
 * keyed on a boolean (voted on any of the last 5 proposals).
 */
export function ActiveBadge({ active, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider',
        active ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted-fg',
        className
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-success' : 'bg-surface-3')}
        aria-hidden
      />
      {active ? 'Active' : 'Dormant'}
    </span>
  )
}
