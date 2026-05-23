'use client'

import { RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error]', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'color-mix(in oklab, #f06464 15%, transparent)' }}
      >
        <RefreshCw className="h-6 w-6" style={{ color: '#f06464' }} />
      </div>
      <div>
        <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
          Something went wrong
        </p>
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-tight tracking-tight">
          Couldn&apos;t load this page
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-fg">
          There was an error fetching on-chain data. This is usually temporary — try again.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-muted-fg/60">
            Digest: {error.digest}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-5 py-2.5 text-sm font-semibold hover:bg-surface-3"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
