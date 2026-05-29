'use client'

import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatEther, parseEther } from 'viem'
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
import { ZORA_PROTOCOL_REWARD, zoraDropAbi } from '@/lib/zora-drop'

type Phase = 'idle' | 'submitting' | 'mining' | 'done' | 'error'

type Props = {
  dropAddress: `0x${string}` | null
  priceEth: string
}

const BASESCAN_BY_CHAIN: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
}

export function DroposalMintWidget({ dropAddress, priceEth }: Props) {
  const ready = useWeb3Ready()
  if (!ready) {
    return (
      <div className="h-[148px] animate-pulse rounded-md border border-border bg-surface-2" />
    )
  }
  if (!dropAddress) {
    return (
      <div className="rounded-md border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-muted-fg">
        This edition hasn&apos;t been deployed on-chain yet — minting is unavailable until
        the proposal executes.
      </div>
    )
  }
  return <DroposalMintWidgetInner dropAddress={dropAddress} priceEth={priceEth} />
}

function DroposalMintWidgetInner({
  dropAddress,
  priceEth,
}: {
  dropAddress: `0x${string}`
  priceEth: string
}) {
  const chainId = daoConfig.chainId
  const [qty, setQty] = useState(1)
  const [comment, setComment] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  const { address: userAddress, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash, chainId })

  const onWrongChain = isConnected && connectedChainId !== chainId

  // Live sale state from the drop contract.
  const { data: saleDetails } = useReadContract({
    address: dropAddress,
    abi: zoraDropAbi,
    functionName: 'saleDetails',
    chainId,
  })

  const publicSaleActive = saleDetails?.publicSaleActive ?? false
  const totalMinted = saleDetails?.totalMinted
  const maxSupply = saleDetails?.maxSupply

  // Exact wei math — never compute the payable value in JS floating point, or a
  // few-wei shortfall can trip Zora's Purchase_WrongPrice revert. `priceEth`
  // comes from formatEther so it round-trips cleanly through parseEther.
  const valueWei = useMemo(() => {
    let priceWei: bigint
    try {
      priceWei = parseEther(priceEth?.trim() ? priceEth : '0')
    } catch {
      priceWei = BigInt(0)
    }
    const rewardWei = parseEther(String(ZORA_PROTOCOL_REWARD))
    return (priceWei + rewardWei) * BigInt(Math.max(1, qty))
  }, [priceEth, qty])

  // Phase machine driven by the write + receipt hooks (house write-tx UX).
  useEffect(() => {
    if (writeError) {
      setPhase('error')
      setError(parseMintError(writeError))
    } else if (isWritePending) setPhase('submitting')
    else if (txHash && isConfirming) setPhase('mining')
    else if (isConfirmed) setPhase('done')
  }, [isWritePending, txHash, isConfirming, isConfirmed, writeError])

  // After confirmation, auto-reset ~1s later so the user can mint again.
  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => {
      setPhase('idle')
      setComment('')
      resetWrite()
    }, 1000)
    return () => clearTimeout(t)
  }, [phase, resetWrite])

  async function handleMint() {
    if (!userAddress) return
    setError(null)
    setPhase('submitting')
    try {
      writeContract({
        address: dropAddress,
        abi: zoraDropAbi,
        functionName: 'mintWithRewards',
        args: [
          userAddress,
          BigInt(Math.max(1, qty)),
          comment,
          daoConfig.addresses.treasury,
        ],
        value: valueWei,
        chainId,
      })
    } catch (e) {
      setPhase('error')
      setError(parseMintError(e))
    }
  }

  const explorerBase = BASESCAN_BY_CHAIN[chainId]
  const txUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null
  const isBusy = phase === 'submitting' || phase === 'mining' || phase === 'done'
  const saleClosed = saleDetails != null && !publicSaleActive

  const totalLabel = formatEther(valueWei)

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-fg">
          Mint
        </div>
        {totalMinted != null && (
          <div className="text-[11.5px] text-muted-fg">
            <span className="font-mono">{totalMinted.toString()}</span>
            {maxSupply != null && maxSupply < BigInt('18446744073709551615') && (
              <>
                {' / '}
                <span className="font-mono">{maxSupply.toString()}</span>
              </>
            )}{' '}
            minted
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-within:border-accent">
          <span className="text-[12px] text-muted-fg">Qty</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            disabled={isBusy}
            className="w-16 min-w-0 bg-transparent text-base font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <div className="min-w-0 text-[12.5px] text-muted-fg">
          Total <span className="font-mono text-fg">{totalLabel} ETH</span>{' '}
          <span className="text-[11px]">
            (incl. {ZORA_PROTOCOL_REWARD} ETH Zora fee/ea)
          </span>
        </div>
      </div>

      <label className="flex items-center rounded-md border border-border bg-surface px-3 py-2 focus-within:border-accent">
        <input
          type="text"
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isBusy}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-fg/60"
        />
      </label>

      {saleClosed && (
        <div className="text-[12px] text-muted-fg">
          The public sale is not active for this edition.
        </div>
      )}

      {error && <div className="text-[12px] text-destructive">{error}</div>}

      {txUrl && (phase === 'mining' || phase === 'done') && (
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-accent-strong hover:underline"
        >
          {phase === 'mining' ? 'View pending tx' : 'View tx'}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {!isConnected ? (
        <Button type="button" variant="primary" size="md" onClick={openConnectModal}>
          Connect wallet
        </Button>
      ) : onWrongChain ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId })}
        >
          {isSwitching ? 'Switching…' : 'Switch network'}
        </Button>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={isBusy || saleClosed}
          onClick={handleMint}
        >
          {phase === 'submitting'
            ? 'Confirm in wallet…'
            : phase === 'mining'
              ? 'Minting…'
              : phase === 'done'
                ? 'Minted ✓'
                : `Mint ${qty > 1 ? `${qty}×` : ''}`}
        </Button>
      )}
    </div>
  )
}

function parseMintError(err: unknown): string | null {
  if (!err) return null
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for this mint.'
  if (/Sale_Inactive|sale.*inactive|not active/i.test(msg))
    return 'The public sale is not active.'
  return msg.split('\n')[0]
}
