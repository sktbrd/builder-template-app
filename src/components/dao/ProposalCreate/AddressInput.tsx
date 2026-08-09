'use client'

import { useEffect, useState } from 'react'
import { normalize } from 'viem/ens'
import { useEnsAddress } from 'wagmi'
import { mainnet } from 'wagmi/chains'

type Props = {
  value: string
  onChange: (resolved0xOrRaw: string) => void
  placeholder?: string
  invalid?: boolean
}

/** `normalize` throws on invalid ENS input — swallow it so partial names don't crash render. */
function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name)
  } catch {
    return undefined
  }
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/**
 * Recipient input with forward-ENS resolution. Anything containing a dot is
 * treated as a name and resolved on mainnet; the draft stores the resolved 0x
 * address (zero schema change) while the field keeps showing what was typed.
 * Plain 0x values pass through unchanged, with `invalid` driving the error style.
 */
export function AddressInput({ value, onChange, placeholder = '0x…', invalid }: Props) {
  // Local display state so the field can show the typed name even though the
  // parent `value` (the draft) holds the resolved 0x address.
  const [display, setDisplay] = useState(value)

  const nameLike = display.includes('.')
  const normalized = nameLike ? safeNormalize(display) : undefined
  const enabled = !!normalized

  const { data, isFetching } = useEnsAddress({
    name: normalized,
    chainId: mainnet.id,
    query: { enabled },
  })

  const resolvedAddr = enabled && data ? data : undefined
  const resolving = enabled && isFetching && !resolvedAddr
  const failed = nameLike && !resolving && !resolvedAddr && display.trim().length > 0

  // Push the resolved 0x up once it differs from what the parent already holds.
  useEffect(() => {
    if (resolvedAddr && resolvedAddr.toLowerCase() !== value.toLowerCase()) {
      onChange(resolvedAddr)
    }
  }, [resolvedAddr, value, onChange])

  const showError = nameLike ? failed : !!invalid

  return (
    <>
      <input
        type="text"
        value={display}
        onChange={(e) => {
          const next = e.target.value
          setDisplay(next)
          // Emit the raw text immediately (pass-through for 0x, and it clears any
          // stale resolved address while editing a name). The effect above then
          // overwrites it with the resolved 0x once/if the name resolves.
          onChange(next)
        }}
        placeholder={placeholder}
        className={textInputClass(showError)}
      />
      {nameLike && resolving && (
        <p className="mt-1 text-[11px] text-muted-fg">Resolving…</p>
      )}
      {nameLike && resolvedAddr && (
        <p className="mt-1 text-[11px] text-success">
          Resolved: {shortAddr(resolvedAddr)}
        </p>
      )}
      {nameLike && failed && (
        <p className="mt-1 text-[11px] text-warning">Could not resolve name</p>
      )}
    </>
  )
}

// Duplicated from DraftForm.tsx (kept identical) rather than imported, to avoid
// a circular import between these two 'use client' modules.
function textInputClass(error: boolean): string {
  return [
    'w-full rounded-md border bg-surface px-3 py-2 font-mono text-xs outline-none',
    error ? 'border-warning focus:border-warning' : 'border-border focus:border-accent',
  ].join(' ')
}
