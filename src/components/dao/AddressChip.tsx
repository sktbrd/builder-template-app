'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  addr: string
  mono?: boolean
  className?: string
}

export function AddressChip({ addr, mono = true, className }: Props) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(addr)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-fg transition-colors hover:bg-surface-3',
        className
      )}
    >
      <span className={mono ? 'font-mono' : ''}>{addr}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-muted-fg" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-fg" />
      )}
    </button>
  )
}
