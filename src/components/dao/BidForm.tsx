'use client'

import { auctionAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type Address, parseEther } from 'viem'
import { useRouter } from 'next/navigation'
import {
  useAccount,
  useBalance,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

type Props = {
  /** ERC721 token id of the live auction. */
  tokenId: number
  /** Current top bid in ETH. Used to compute the minimum next bid. */
  topBid: number
  /** Increment factor — Builder default 1.02 (2%). */
  minIncrementPct?: number
  /** Whether to surface the optional 140-char on-chain comment field.
   * The comment is informational only — Builder's createBid doesn't take a
   * comment parameter on-chain. The field exists for future surfacing on
   * the bid history once a Bid Comments contract / hook lands upstream. */
  enableComment?: boolean
}

export function BidForm(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return <BidFormSkeleton />
  return <BidFormInner {...props} />
}

function BidFormSkeleton() {
  return <div className="h-[120px] animate-pulse rounded-md bg-surface-2" />
}

function BidFormInner({
  tokenId,
  topBid,
  minIncrementPct = 1.02,
  enableComment = true,
}: Props) {
  const [bid, setBid] = useState('')
  const [comment, setComment] = useState('')
  const router = useRouter()

  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const { data: balance } = useBalance({
    address,
    chainId: daoConfig.chainId,
    query: { enabled: !!address },
  })

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  const minBid = useMemo(
    () => (topBid * minIncrementPct).toFixed(3),
    [topBid, minIncrementPct]
  )
  const numeric = parseFloat(bid)
  const balanceEth = balance ? Number(balance.formatted) : undefined
  const belowMin = !Number.isNaN(numeric) && numeric < parseFloat(minBid)
  const overBalance =
    !Number.isNaN(numeric) && balanceEth !== undefined && numeric > balanceEth

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()
  const {
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (!isMined) return
    // Refresh server data so the new top bid appears immediately
    router.refresh()
    const t = setTimeout(() => {
      setBid('')
      setComment('')
      resetWrite()
    }, 2400)
    return () => clearTimeout(t)
  }, [isMined, resetWrite, router])

  const phase: 'connect' | 'switch' | 'sign' | 'mine' | 'done' | 'error' | 'idle' =
    !isConnected
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

  const submit = () => {
    if (!bid) return
    let valueWei: bigint
    try {
      valueWei = parseEther(bid)
    } catch {
      return
    }
    writeContract({
      address: daoConfig.addresses.auction as Address,
      abi: auctionAbi,
      functionName: 'createBid',
      args: [BigInt(tokenId)],
      value: valueWei,
    })
  }

  const canSubmit =
    !!bid &&
    !belowMin &&
    !overBalance &&
    isConnected &&
    !onWrongChain &&
    phase !== 'sign' &&
    phase !== 'mine'

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-surface-2 p-4">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-md border border-border bg-surface px-3 transition-[box-shadow,border-color] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <input
            type="text"
            inputMode="decimal"
            placeholder={`${minBid} or more`}
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            disabled={phase === 'sign' || phase === 'mine'}
            className="flex-1 border-0 bg-transparent py-2.5 text-sm outline-none disabled:opacity-50"
          />
          <span className="text-[13px] font-semibold text-muted-fg">ETH</span>
        </div>
        {phase === 'connect' ? (
          <Button onClick={() => openConnectModal?.()}>Connect</Button>
        ) : phase === 'switch' ? (
          <Button
            onClick={() => switchChain({ chainId: daoConfig.chainId })}
            disabled={isSwitching}
          >
            {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
            Switch
          </Button>
        ) : (
          <Button onClick={submit} disabled={!canSubmit}>
            {phase === 'sign' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirm…
              </>
            )}
            {phase === 'mine' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            )}
            {phase === 'done' && 'Submitted ✓'}
            {(phase === 'idle' || phase === 'error') && 'Place bid'}
          </Button>
        )}
      </div>

      {enableComment && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Optional onchain comment (140 chars)"
            maxLength={140}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={phase === 'sign' || phase === 'mine'}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent disabled:opacity-50"
          />
          <span className="text-[12.5px] text-muted-fg">{comment.length}/140</span>
        </div>
      )}

      <div className="text-[12.5px] text-muted-fg">
        {phase === 'connect' ? (
          <span>Connect a wallet to place a bid.</span>
        ) : phase === 'switch' ? (
          <span className="text-warning">
            Wrong network — switch to {chainNameOf(daoConfig.chainId)}.
          </span>
        ) : phase === 'error' ? (
          <span className="text-destructive">
            {parseWriteError(writeError ?? mineError)}
          </span>
        ) : belowMin ? (
          <span className="text-warning">Bid must be at least {minBid} ETH.</span>
        ) : overBalance && balanceEth !== undefined ? (
          <span className="text-warning">
            Bid exceeds wallet balance ({balanceEth.toFixed(4)} ETH).
          </span>
        ) : (
          <>
            {balanceEth !== undefined ? (
              <>Balance: {balanceEth.toFixed(4)} ETH · </>
            ) : null}
            Network: {chainNameOf(daoConfig.chainId)} ✓
          </>
        )}
      </div>
    </div>
  )
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
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas + bid.'
  return msg.split('\n')[0]
}
