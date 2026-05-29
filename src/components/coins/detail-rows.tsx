'use client'

import { CheckCircle2, Copy } from 'lucide-react'
import { useState } from 'react'

/**
 * Shared label/value rows for the content detail pages (CoinDetail +
 * DroposalDetail). Extracted so both detail layouts read identically.
 */

export function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[12px] uppercase tracking-wider text-muted-fg">
        {label}
      </span>
      <div className="flex min-w-0 max-w-full justify-end overflow-hidden text-right [&_*]:min-w-0">
        {children}
      </div>
    </div>
  )
}

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 text-[12px] uppercase tracking-wider text-muted-fg">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 break-all font-mono text-[12.5px]" title={value}>
          {shortValue(value)}
        </span>
        <button
          type="button"
          onClick={async () => {
            if (!value) return
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            } catch {
              // ignore
            }
          }}
          className="shrink-0 rounded-md p-1 text-muted-fg transition-colors hover:bg-surface hover:text-fg"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

export function shortValue(value: string): string {
  if (!value) return value
  if (value.startsWith('0x') && value.length > 12) {
    return `${value.slice(0, 6)}…${value.slice(-4)}`
  }
  if (value.startsWith('ipfs://')) {
    const cid = value.slice('ipfs://'.length)
    if (cid.length <= 16) return value
    return `ipfs://${cid.slice(0, 6)}…${cid.slice(-4)}`
  }
  if (value.length > 24) {
    return `${value.slice(0, 10)}…${value.slice(-6)}`
  }
  return value
}
