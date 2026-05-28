'use client'

import { useConnectModal } from '@rainbow-me/rainbowkit'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { type Address, parseEther } from 'viem'
import {
  useAccount,
  useBalance,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { ActorIdentity } from '@/components/feed/ActorIdentity'
import { Button } from '@/components/ui/button'
import { encodeCreateBidCalldata } from '@/lib/bid-comment'
import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

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
  /**
   * When true, drops the surrounding card chrome (border / bg / padding) and
   * the static "Balance · Network ✓" footer line, leaving just the input pill
   * + button row and any active error/warning. Used on the homepage hero so
   * the bid widget reads as minimal like nouns.game's hero.
   */
  compact?: boolean
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
  compact = false,
}: Props) {
  const [bid, setBid] = useState('')
  const [comment, setComment] = useState('')
  // Holds onto the success state for a few seconds AFTER the contract reports
  // the new bid, so the user sees unambiguous "Bid placed" feedback before
  // the form resets and the hero refetches the new top bid.
  const [justBidEth, setJustBidEth] = useState<string | null>(null)
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
    sendTransaction,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useSendTransaction()
  const {
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (!isMined) return
    // Capture the bid amount up-front so the success banner can keep showing
    // even after the form resets. Mirrors the settle action's success-handoff
    // pattern. Intentional sync setState — this is the success-handoff edge.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustBidEth(bid)
    // Refresh server data so the new top bid appears immediately
    router.refresh()
    const t = setTimeout(() => {
      setBid('')
      setComment('')
      setJustBidEth(null)
      resetWrite()
    }, 3500)
    return () => clearTimeout(t)
  }, [isMined, resetWrite, router, bid])

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

  // Persistent success banner — survives the router.refresh re-render so the
  // user gets unambiguous feedback that the bid landed before the form resets.
  if (justBidEth !== null) {
    return (
      <div
        className={cn(
          'flex flex-col gap-2',
          compact ? '' : 'rounded-md border border-success/40 bg-success/10 p-4'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 text-success',
            compact ? 'h-12 rounded-full border border-success/40 bg-success/10 px-5' : ''
          )}
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-sm font-semibold">Bid placed — {justBidEth} ETH</span>
        </div>
        {!compact && (
          <p className="text-[12.5px] text-success/80">Refreshing the live auction…</p>
        )}
      </div>
    )
  }

  const submit = () => {
    if (!bid) return
    let valueWei: bigint
    try {
      valueWei = parseEther(bid)
    } catch {
      return
    }
    // Pack the comment into the trailing bytes of the createBid calldata so
    // it persists on-chain in the same tx (gnars-style). The EVM ignores
    // anything past the function args; we read it back from tx input later.
    const data = encodeCreateBidCalldata(BigInt(tokenId), comment)
    // Pin chainId so viem rejects on the wrong network instead of silently
    // sending the bid on whatever chain the wallet is currently on.
    sendTransaction({
      to: daoConfig.addresses.auction as Address,
      data,
      value: valueWei,
      chainId: daoConfig.chainId,
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

  const showIdentity = isConnected && !onWrongChain && address

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5',
        compact ? '' : 'rounded-md border border-border bg-surface-2 p-4'
      )}
    >
      {showIdentity && (
        <div
          className={cn(
            'flex items-center gap-2',
            compact ? 'pl-1 text-[11.5px]' : 'text-[12px]'
          )}
        >
          <span className="font-semibold uppercase tracking-[0.14em] text-fg/50">
            Bidding as
          </span>
          <ActorIdentity address={address} size={20} className="text-[12.5px]" />
        </div>
      )}

      <div className={cn('flex', compact ? 'gap-2.5' : 'gap-2')}>
        <div
          className={cn(
            'flex flex-1 items-center transition-[box-shadow,border-color] focus-within:ring-2 focus-within:ring-accent/20',
            // Compact = pill input that pairs with the accent button: same
            // accent hue, lighter shade — so input + button read as one unit.
            compact
              ? 'h-12 rounded-full border border-accent/30 bg-accent/10 px-5 text-fg focus-within:border-accent'
              : 'rounded-md border border-border bg-surface px-3 focus-within:border-accent'
          )}
        >
          <input
            type="text"
            inputMode="decimal"
            placeholder={minBid}
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            disabled={phase === 'sign' || phase === 'mine'}
            className={cn(
              'flex-1 border-0 bg-transparent outline-none disabled:opacity-50',
              compact
                ? 'text-[17px] font-semibold tabular-nums placeholder:font-medium placeholder:text-fg/40'
                : 'py-2.5 text-sm'
            )}
          />
          <span
            className={cn(
              'font-semibold',
              compact
                ? 'ml-2 text-[13px] tracking-wider text-fg/60'
                : 'text-[13px] text-muted-fg'
            )}
          >
            ETH
          </span>
        </div>
        {(() => {
          const buttonCls = compact ? 'h-12 rounded-full px-6 text-[15px] shadow-sm' : ''
          if (phase === 'connect') {
            return (
              <Button onClick={() => openConnectModal?.()} className={buttonCls}>
                Connect
              </Button>
            )
          }
          if (phase === 'switch') {
            return (
              <Button
                onClick={() => switchChain({ chainId: daoConfig.chainId })}
                disabled={isSwitching}
                className={buttonCls}
              >
                {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
                Switch
              </Button>
            )
          }
          return (
            <Button onClick={submit} disabled={!canSubmit} className={buttonCls}>
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
              {(phase === 'idle' || phase === 'error') && (compact ? 'Bid' : 'Place bid')}
            </Button>
          )
        })()}
      </div>

      {enableComment && (
        <div
          className={cn(
            'flex items-center transition-[box-shadow,border-color] focus-within:ring-2 focus-within:ring-accent/20',
            // Compact = pill that visually pairs with the bid pill above:
            // same accent tint, same rounded-full shape, shorter height.
            compact
              ? 'gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2 focus-within:border-accent'
              : 'gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-accent'
          )}
        >
          <input
            type="text"
            placeholder={
              compact
                ? 'Say something (optional)'
                : 'Optional onchain comment (140 chars)'
            }
            maxLength={140}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={phase === 'sign' || phase === 'mine'}
            className={cn(
              'flex-1 border-0 bg-transparent outline-none disabled:opacity-50',
              compact ? 'text-[13.5px] text-fg placeholder:text-fg/40' : 'text-[13px]'
            )}
          />
          <span
            className={cn(
              'shrink-0 tabular-nums',
              compact ? 'text-[11.5px] text-fg/50' : 'text-[12.5px] text-muted-fg'
            )}
          >
            {comment.length}/140
          </span>
        </div>
      )}

      <div
        className={cn('text-[12px]', compact ? 'pl-5 text-neutral-500' : 'text-muted-fg')}
      >
        {phase === 'switch' ? (
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
        ) : compact ? (
          // Minimal Reserve hint mirrors nouns.game's "Reserve: 2.80 ETH" line.
          <span>Reserve: {minBid} ETH</span>
        ) : phase === 'connect' ? (
          <span>Connect a wallet to place a bid.</span>
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
