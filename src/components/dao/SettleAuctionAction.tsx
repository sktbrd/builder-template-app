'use client'

import { auctionAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { type Address } from 'viem'
import {
  useAccount,
  useChainId,
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

function SettleAuctionActionInner({ tokenId, onSettled }: Props) {
  const { isConnected } = useAccount()
  const nowMs = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot)
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

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
    refetch()
    const t = setTimeout(() => {
      resetWrite()
      onSettled?.()
    }, 1500)
    return () => clearTimeout(t)
  }, [isMined, refetch, resetWrite, onSettled])

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
    writeContract({
      address: daoConfig.addresses.auction as Address,
      abi: auctionAbi,
      functionName: 'settleCurrentAndCreateNewAuction',
    })
  }

  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="mb-2 text-sm font-semibold">
        This auction is awaiting settlement
      </div>
      <div className="mb-2.5 text-[12.5px] text-muted-fg">
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
