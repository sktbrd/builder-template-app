'use client'

import { auctionAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { type Address } from 'viem'
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'

type Props = {
  /** Token id of the auction this page represents. */
  tokenId: number
  onSettled?: () => void
  /** Rendered on a dark tinted background (the dashboard hero) — use light
   *  text + border so the panel reads against the color. */
  onTinted?: boolean
}

let currentTimeMs = 0

const subscribeNow = (onStoreChange: () => void) => {
  const updateNow = () => {
    currentTimeMs = Date.now()
    onStoreChange()
  }

  updateNow()
  const interval = window.setInterval(updateNow, 30_000)
  return () => window.clearInterval(interval)
}

const getNowSnapshot = () => currentTimeMs
const getNowServerSnapshot = () => 0

/**
 * Surfaces the "settle + start next auction" button on /auction/[id] when
 *   - this page's tokenId matches the current onchain auction
 *   - that auction's endTime is in the past
 *   - the auction is not yet settled
 *
 * Calls auction.settleCurrentAndCreateNewAuction() — the standard Builder
 * flow that settles the current auction and seeds the next token.
 */
export function SettleAuctionAction(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return null
  return <SettleAuctionActionInner {...props} />
}

function SettleAuctionActionInner({ tokenId, onSettled, onTinted }: Props) {
  const { isConnected, chainId: walletChainId } = useAccount()
  const nowMs = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot)
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const router = useRouter()
  // Holds onto the success state for a few seconds AFTER the contract reports
  // settled=true, so the component doesn't snap-unmount before the user has a
  // chance to register that the tx landed.
  const [justSettledTokenId, setJustSettledTokenId] = useState<number | null>(null)

  const onWrongChain =
    isConnected && walletChainId != null && walletChainId !== daoConfig.chainId

  const { data: auctionState, refetch } = useReadContract({
    address: daoConfig.addresses.auction as Address,
    abi: auctionAbi,
    functionName: 'auction',
    chainId: daoConfig.chainId,
  })

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
    // Capture the success state up-front so we keep rendering the success
    // banner even after the refetch flips `settled` to true (which would
    // otherwise immediately unmount this component). Intentional sync
    // setState — this is the success-handoff edge.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustSettledTokenId(tokenId)
    refetch()
    // router.refresh() invalidates the server component cache so the
    // homepage's currentAuction prop swaps to the new live token without a
    // manual page reload.
    router.refresh()
    const t = setTimeout(() => {
      resetWrite()
      setJustSettledTokenId(null)
      onSettled?.()
    }, 4500)
    return () => clearTimeout(t)
  }, [isMined, refetch, resetWrite, onSettled, router, tokenId])

  // Persistent success banner — survives the auctionState refetch flipping
  // `settled` to true, so the user gets unambiguous feedback before the
  // component hands off to the new live auction.
  if (justSettledTokenId !== null) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-success">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
          Auction #{justSettledTokenId} settled
        </div>
        <p className="mt-1 text-[12.5px] text-success/80">
          The next auction is starting — the dashboard will update shortly.
        </p>
      </div>
    )
  }

  if (!auctionState) return null
  const [currentTokenId, , , , endTime, settled] = auctionState as readonly [
    bigint,
    bigint,
    string,
    number,
    number,
    boolean,
  ]

  const isCurrentPage = Number(currentTokenId) === tokenId
  const ended = Number(endTime) > 0 && Number(endTime) * 1000 < nowMs
  if (!isCurrentPage || !ended || settled) return null

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
    // Pin chainId so viem refuses to broadcast on the wrong network even if
    // the wallet desynced from wagmi's `useChainId` between renders. Without
    // this, the tx fires on whatever chain the wallet happens to be on
    // (e.g. Arbitrum) and silently does nothing onchain for this DAO.
    writeContract({
      address: daoConfig.addresses.auction as Address,
      abi: auctionAbi,
      functionName: 'settleCurrentAndCreateNewAuction',
      chainId: daoConfig.chainId,
    })
  }

  return (
    <div
      className={`rounded-md border px-4 py-3 ${onTinted ? 'border-white/25 bg-white/5' : 'border-accent/30 bg-accent/5'}`}
    >
      <div className="mb-2 text-sm font-semibold">
        This auction is awaiting settlement
      </div>
      <div
        className={`mb-2.5 text-[12.5px] ${onTinted ? 'text-white/85' : 'text-muted-fg'}`}
      >
        Anyone can call settle to finalise this auction and seed the next one.
      </div>

      {phase === 'connect' ? (
        <Button onClick={() => openConnectModal?.()} className="w-full">
          Connect wallet to settle
        </Button>
      ) : phase === 'switch' ? (
        <Button
          onClick={() => switchChain({ chainId: daoConfig.chainId })}
          className="w-full"
          disabled={isSwitching}
        >
          {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
          Switch network
        </Button>
      ) : (
        <Button
          onClick={submit}
          disabled={phase === 'sign' || phase === 'mine'}
          className="w-full"
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
              Settling…
            </>
          )}
          {phase === 'done' && 'Settled ✓'}
          {(phase === 'idle' || phase === 'error') && 'Settle & start next'}
        </Button>
      )}

      {phase === 'error' && (
        <div className="mt-2 text-[12.5px] text-destructive">
          {parseWriteError(writeError ?? mineError)}
        </div>
      )}
    </div>
  )
}

function parseWriteError(err: unknown): string {
  if (!err) return 'Something went wrong.'
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  if (/auction has not ended|AUCTION_NOT_OVER/i.test(msg))
    return 'Auction has not ended yet.'
  return msg.split('\n')[0]
}
