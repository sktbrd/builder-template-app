'use client'

import { useDecodedTransactions } from '@buildeross/hooks/useDecodedTransactions'
import type { CHAIN_ID, DecodedArg, DecodedValue } from '@buildeross/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatEther } from 'viem'

import { cn } from '@/lib/utils'

type Props = {
  chainId: number
  targets: string[]
  calldatas: string[]
  values: string[]
}

// `useDecodedTransactions` only reads `{ targets, calldatas, values }` off the
// proposal. We synthesize that shape rather than dragging the full Proposal
// type from the subgraph into the client — keeps the prop surface minimal.
type ProposalLike = {
  targets: string[]
  calldatas: string[]
  values: string[]
}

export function DecodedTransactions({ chainId, targets, calldatas, values }: Props) {
  const proposal = { targets, calldatas, values } as unknown as ProposalLike
  const { decodedTransactions, isLoading } = useDecodedTransactions(
    chainId as CHAIN_ID,
    // The hook signature requires Proposal from @buildeross/sdk/subgraph but only
    // touches the three array fields above. Cast is safe.
    proposal as never,
    targets.length > 0
  )

  if (targets.length === 0) {
    return (
      <div className="text-sm text-muted-fg">(No transactions on this proposal.)</div>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {targets.map((target, i) => {
        const decoded = decodedTransactions?.[i]
        let valueWei: bigint
        try {
          valueWei = BigInt(values[i] ?? '0')
        } catch {
          valueWei = BigInt(0)
        }
        return (
          <DecodedRow
            key={i}
            target={target}
            valueEth={formatEther(valueWei)}
            calldata={calldatas[i] ?? '0x'}
            decoded={decoded}
            loading={isLoading && !decoded}
          />
        )
      })}
    </ul>
  )
}

type DecodedItem = NonNullable<
  ReturnType<typeof useDecodedTransactions>['decodedTransactions']
>[number]

function DecodedRow({
  target,
  valueEth,
  calldata,
  decoded,
  loading,
}: {
  target: string
  valueEth: string
  calldata: string
  decoded: DecodedItem | undefined
  loading: boolean
}) {
  const [open, setOpen] = useState(false)

  const isEthTransfer = calldata === '0x'
  const decodedOk = decoded && !decoded.isNotDecoded
  const decodedMiss = decoded && decoded.isNotDecoded && calldata !== '0x'

  const fnLabel = decodedOk
    ? typeof decoded.transaction === 'object' && 'functionName' in decoded.transaction
      ? decoded.transaction.functionName
      : '(unknown)'
    : isEthTransfer
      ? 'Send ETH'
      : loading
        ? 'Decoding…'
        : 'Raw call'

  return (
    <li className="rounded-md bg-surface-2 px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 flex w-full items-center justify-between gap-3 rounded-sm px-1 text-left hover:bg-surface-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-fg" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-fg" />
          )}
          <span
            className={cn(
              'truncate font-mono text-[13px] font-semibold',
              decodedOk
                ? 'text-fg'
                : decodedMiss
                  ? 'text-warning'
                  : isEthTransfer
                    ? 'text-fg'
                    : 'text-muted-fg'
            )}
          >
            {fnLabel}
          </span>
          <span className="hidden truncate font-mono text-[12px] text-muted-fg sm:inline">
            → {short(target)}
          </span>
        </div>
        <div className="shrink-0 text-sm font-bold">{trimDecimals(valueEth, 4)} ETH</div>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
          <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-[100px_1fr]">
            <div className="text-muted-fg">Target</div>
            <div className="break-all font-mono text-xs">{target}</div>
          </div>
          {decodedOk && typeof decoded.transaction === 'object' ? (
            <DecodedArgs
              functionSig={decoded.transaction.functionSig}
              args={decoded.transaction.args}
              argOrder={decoded.transaction.argOrder}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-[100px_1fr]">
              <div className="text-muted-fg">Calldata</div>
              <div className="break-all font-mono text-xs">
                {calldata || '0x'}
                {decodedMiss && (
                  <span className="ml-2 inline-block rounded-full bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-warning">
                    not decoded
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function DecodedArgs({
  functionSig,
  args,
  argOrder,
}: {
  functionSig: string
  args: Record<string, DecodedArg>
  argOrder: string[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {functionSig && (
        <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-[100px_1fr]">
          <div className="text-muted-fg">Signature</div>
          <div className="break-all font-mono text-xs">{functionSig}</div>
        </div>
      )}
      {argOrder.length > 0 && (
        <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-[100px_1fr]">
          <div className="text-muted-fg">Args</div>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {argOrder.map((name) => {
              const arg = args[name]
              if (!arg) return null
              return (
                <li key={name} className="flex flex-col gap-0.5">
                  <span>
                    <span className="text-muted-fg">{name}</span>{' '}
                    <span className="text-muted-fg">({arg.type})</span>
                  </span>
                  <span className="break-all">{renderValue(arg.value)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// `DecodedValue` is recursive (primitive | primitive[] | tuple | tuple[]). We
// flatten to a single string for display since the surface is read-only.
function renderValue(v: DecodedValue): string {
  if (Array.isArray(v)) {
    return `[${v.map((x) => renderValue(x as DecodedValue)).join(', ')}]`
  }
  if (typeof v === 'object' && v !== null) {
    const entries = Object.entries(v).map(
      ([k, val]) => `${k}: ${renderValue(val as DecodedValue)}`
    )
    return `{ ${entries.join(', ')} }`
  }
  return String(v)
}

function short(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function trimDecimals(value: string, max: number): string {
  if (!value) return value
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  return `${intPart}.${decPart.slice(0, max).replace(/0+$/, '') || '0'}`
}
