'use client'

import { EAS_CONTRACT_ADDRESS, easAbi, PROPDATE_SCHEMA_UID } from '@buildeross/constants/eas'
import { type PropDate } from '@buildeross/sdk/subgraph'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Hex } from 'viem'
import { zeroHash } from 'viem'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { buildPropdateAttestation } from '@/lib/propdates'
import { cn } from '@/lib/utils'

export type PropdateReplyTarget = {
  id: Hex
  creator: Hex
  message: string
}

type Props = {
  proposalIdHash: Hex
  replyTo?: PropdateReplyTarget
  /** Called immediately after the tx mines with an optimistic PropDate to inject
   * into the list. Parent is responsible for running awaitSubgraphSync + the
   * canonical refetch in the background. */
  onPosted: (optimistic: PropDate, blockNumber: bigint) => void
  /** Closes the form. Called by both the manual Cancel button and the 1s
   * auto-close after "Posted ✓". */
  onClose?: () => void
}

export function PropdateForm({ proposalIdHash, replyTo, onPosted, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  // Ref (not state) so flipping it doesn't trigger a re-render — otherwise
  // the effect re-fires, its cleanup clears the 1s timer, and the form never
  // auto-closes after "Posted ✓".
  const handledTxRef = useRef<Hex | undefined>(undefined)

  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const easContractAddress = EAS_CONTRACT_ADDRESS[daoConfig.chainId]
  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const {
    data: receipt,
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: daoConfig.chainId })

  // After mine: inject optimistic PropDate into the list immediately, show
  // "Posted ✓" for ~1s, then auto-close. Subgraph sync happens in the parent.
  useEffect(() => {
    if (!isMined || !receipt || !address) return
    const txHash = receipt.transactionHash as Hex
    if (handledTxRef.current === txHash) return
    handledTxRef.current = txHash

    const optimistic: PropDate = {
      id: txHash,
      creator: address as Hex,
      proposalId: proposalIdHash,
      originalMessageId: (replyTo?.id ?? zeroHash) as Hex,
      milestoneId: null,
      message: message.trim(),
      txid: txHash,
      timeCreated: Math.floor(Date.now() / 1000),
    }
    onPosted(optimistic, receipt.blockNumber)

    const t = setTimeout(() => {
      setMessage('')
      resetWrite()
      onClose?.()
    }, 1000)
    return () => clearTimeout(t)
    // `message` intentionally excluded — captured at mine time on purpose, and
    // adding it would re-run the effect when we clear it inside the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMined, receipt, address, proposalIdHash, replyTo?.id, onPosted, onClose, resetWrite])

  const submit = () => {
    if (!message.trim()) return
    if (!easContractAddress) return
    const request = buildPropdateAttestation(
      PROPDATE_SCHEMA_UID,
      proposalIdHash,
      message,
      replyTo?.id
    )
    writeContract({
      address: easContractAddress,
      abi: easAbi,
      functionName: 'attest',
      args: [request],
      chainId: daoConfig.chainId,
    })
  }

  const cancel = () => {
    setMessage('')
    setShowPreview(false)
    onClose?.()
  }

  const phase: 'idle' | 'connect' | 'switch' | 'sign' | 'mine' | 'done' | 'error' =
    !easContractAddress
      ? 'error'
      : !isConnected
        ? 'connect'
        : onWrongChain
          ? 'switch'
          : isWriting
            ? 'sign'
            : isMining
              ? 'mine'
              : isMined
                ? 'done'
                : writeError || mineError
                  ? 'error'
                  : 'idle'

  const disabled = phase === 'sign' || phase === 'mine'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">
          {replyTo ? 'Reply to propdate' : 'Post a propdate'}
        </h4>
        <div className="inline-flex items-center rounded-md bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={
              !showPreview
                ? 'rounded-sm bg-surface px-2.5 py-1 text-[12px] font-semibold text-fg shadow-sm'
                : 'rounded-sm px-2.5 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
            }
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={
              showPreview
                ? 'rounded-sm bg-surface px-2.5 py-1 text-[12px] font-semibold text-fg shadow-sm'
                : 'rounded-sm px-2.5 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
            }
          >
            Preview
          </button>
        </div>
      </div>

      {replyTo ? (
        <div className="flex flex-col gap-1 rounded-md bg-surface-2 px-3 py-2">
          <div className="flex items-center gap-2 text-[12.5px] text-muted-fg">
            <span>Replying to</span>
            <ActorIdentity address={replyTo.creator} size={20} />
          </div>
          <div className="line-clamp-2 text-[12.5px] text-muted-fg">
            {replyTo.message}
          </div>
        </div>
      ) : null}

      {showPreview ? (
        <div className="min-h-[120px] rounded-md border border-dashed border-border bg-surface-2 px-4 py-3">
          {message ? (
            <Markdown>{message}</Markdown>
          ) : (
            <div className="text-sm text-muted-fg">Nothing to preview yet.</div>
          )}
        </div>
      ) : (
        <textarea
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Markdown supported — headings, lists, links, code…"
          disabled={disabled}
          className={cn(
            'w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accent',
            disabled && 'opacity-60'
          )}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] text-muted-fg">
          {address ? (
            <>
              Posting as <strong className="font-mono">{short(address)}</strong>
            </>
          ) : (
            <>Connect a wallet to post.</>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
          {phase === 'connect' ? (
            <Button type="button" size="sm" onClick={() => openConnectModal?.()}>
              Connect wallet
            </Button>
          ) : phase === 'switch' ? (
            <Button
              type="button"
              size="sm"
              onClick={() => switchChain({ chainId: daoConfig.chainId })}
              disabled={isSwitching}
            >
              {isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Switch to {chainNameOf(daoConfig.chainId)}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={
                !message.trim() || disabled || phase === 'done' || phase === 'error'
              }
            >
              {phase === 'sign' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirm in wallet…
                </>
              )}
              {phase === 'mine' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              )}
              {phase === 'done' && 'Posted ✓'}
              {(phase === 'idle' || phase === 'error') && (replyTo ? 'Send reply' : 'Post propdate')}
            </Button>
          )}
        </div>
      </div>

      {!easContractAddress ? (
        <div className="text-[12.5px] text-destructive">
          Propdates are not supported on {chainNameOf(daoConfig.chainId)}.
        </div>
      ) : phase === 'error' ? (
        <div className="text-[12.5px] text-destructive">
          {parseWriteError(writeError ?? mineError)}
        </div>
      ) : null}
    </div>
  )
}

function short(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function chainNameOf(id: number): string {
  return (
    {
      1: 'Ethereum',
      10: 'Optimism',
      8453: 'Base',
      7777777: 'Zora',
    }[id] ?? `Chain ${id}`
  )
}

function parseWriteError(err: unknown): string {
  if (!err) return 'Something went wrong.'
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  return msg.split('\n')[0]
}
