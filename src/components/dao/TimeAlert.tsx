'use client'

import { Clock, X } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

type Tone = 'accent' | 'warning' | 'destructive'

type Props = {
  icon?: React.ReactNode
  tone?: Tone
  dismissible?: boolean
  children: React.ReactNode
  className?: string
}

const TONE: Record<Tone, string> = {
  accent:
    'border-accent/25 bg-accent/10 text-accent-strong [--alert-icon:var(--accent-strong)]',
  warning: 'border-warning/25 bg-warning/10 text-warning [--alert-icon:var(--warning)]',
  destructive:
    'border-destructive/25 bg-destructive/10 text-destructive [--alert-icon:var(--destructive)]',
}

export function TimeAlert({
  icon,
  tone = 'accent',
  dismissible = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-4 py-2.5 text-sm font-medium',
        TONE[tone],
        className
      )}
      role="status"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon ?? <Clock className="h-4 w-4" />}
      </span>
      <span className="flex-1">{children}</span>
      {dismissible && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss"
          className="ml-auto rounded p-0.5 text-current opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
