import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** When true, render full "Insufficient treasury" label. Default is icon-only chip. */
  withLabel?: boolean
}

/**
 * Warning chip surfaced on proposals whose decoded requested amount (ETH or
 * any tracked ERC-20) exceeds the treasury's current balance. Only set on
 * live proposals (pending / active / succeeded / queued).
 */
export function TreasuryInsufficientBadge({ className, withLabel = false }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-warning',
        className
      )}
      title="The treasury currently holds less than this proposal requests"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {withLabel ? 'Insufficient treasury' : 'Insufficient'}
    </span>
  )
}
