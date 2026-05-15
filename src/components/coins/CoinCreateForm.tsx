'use client'

import { COIN_DEPLOYMENT_DISCLAIMER, WETH_ADDRESS } from '@buildeross/constants'
import { useEthUsdPrice } from '@buildeross/hooks'
import { uploadFile, uploadJson } from '@buildeross/ipfs-service'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { type MediaSelection, MediaUploader } from '@/components/coins/MediaUploader'
import { Button } from '@/components/ui/button'
import { prepareClankerDeployTx, type PreparedDeployTx } from '@/lib/coining'
import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  84532: 'Base Sepolia',
}

export function CoinCreateForm() {
  const ready = useWeb3Ready()
  if (!ready) return <Skeleton />

  if (!isChainIdSupportedByCoining(daoConfig.chainId)) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <h3 className="text-base font-bold">Coins are not supported on this chain</h3>
        <p className="mt-1 text-sm text-muted-fg">
          Clanker deployments are only available on Base and Base Sepolia today.
        </p>
      </div>
    )
  }

  return <CoinCreateFormInner />
}

function Skeleton() {
  return <div className="h-[680px] animate-pulse rounded-xl bg-surface-2" />
}

function CoinCreateFormInner() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [media, setMedia] = useState<MediaSelection>(null)
  const [accepted, setAccepted] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  // Carry the predicted coin address through the mine → done transition so the
  // success card can deep-link to /coins/[address] before the subgraph catches up.
  const expectedAddressRef = useRef<Address | null>(null)
  const handledTxRef = useRef<Hex | undefined>(undefined)

  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract()

  const {
    data: receipt,
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: daoConfig.chainId })

  const {
    price: ethUsdPrice,
    isLoading: priceLoading,
    error: priceError,
  } = useEthUsdPrice()

  const phase:
    | 'idle'
    | 'connect'
    | 'switch'
    | 'preparing'
    | 'sign'
    | 'mine'
    | 'done'
    | 'error' = !isConnected
    ? 'connect'
    : onWrongChain
      ? 'switch'
      : isPreparing
        ? 'preparing'
        : isWriting
          ? 'sign'
          : isMining
            ? 'mine'
            : isMined
              ? 'done'
              : writeError || mineError || prepError
                ? 'error'
                : 'idle'

  // After mine: navigate to /coins/[expectedAddress]. Ref-based dedup matches the
  // PropdateForm pattern — useState would re-trigger the effect mid-timeout.
  useEffect(() => {
    if (!isMined || !receipt) return
    const txHashLocal = receipt.transactionHash as Hex
    if (handledTxRef.current === txHashLocal) return
    handledTxRef.current = txHashLocal

    const expected = expectedAddressRef.current
    const t = setTimeout(() => {
      if (expected) {
        router.push(`/coins/${expected}`)
      } else {
        router.push('/coins')
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [isMined, receipt, router])

  const valid = !!name.trim() && !!symbol.trim() && !!description.trim() && !!media

  async function submit() {
    if (!valid || !address) return
    if (!ethUsdPrice) {
      setPrepError('Waiting for ETH price… try again in a moment.')
      return
    }

    const wethAddress = WETH_ADDRESS[daoConfig.chainId as keyof typeof WETH_ADDRESS]
    if (!wethAddress) {
      setPrepError(`WETH address not configured for chain ${daoConfig.chainId}.`)
      return
    }

    setPrepError(null)
    setIsPreparing(true)

    try {
      // 1) Upload primary media (image OR video).
      const mediaUpload = await uploadFile(media!.file, {
        type: media!.kind === 'image' ? 'image' : 'media',
      })

      // 2) For videos, also upload the thumbnail — clanker stores a single
      // `image` URI per coin, so we use the thumbnail as the image and store
      // the video URI inside the metadata JSON as `animation_url`.
      let imageUri = mediaUpload.uri
      let animationUri: string | undefined
      if (media!.kind === 'video') {
        const thumbUpload = await uploadFile(media!.thumbnail, { type: 'image' })
        imageUri = thumbUpload.uri
        animationUri = mediaUpload.uri
      }

      // 3) Upload an EIP-7572-ish metadata JSON. Clanker only uses `image` +
      // `description` at the SDK level, but pinning a richer JSON keeps the
      // video reachable from anything that follows OpenSea conventions.
      const metadata = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        image: imageUri,
        ...(animationUri ? { animation_url: animationUri } : {}),
      }
      await uploadJson(metadata)

      // 4) Build + prepare the Clanker deploy tx.
      const prepared: PreparedDeployTx = await prepareClankerDeployTx({
        chainId: daoConfig.chainId,
        deployer: address,
        currency: wethAddress as Address,
        quoteTokenUsd: ethUsdPrice,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        description: description.trim(),
        image: imageUri,
      })

      expectedAddressRef.current = prepared.expectedAddress

      // 5) Hand off to wagmi.

      writeContract({
        address: prepared.target,

        abi: prepared.abi as any,
        functionName: prepared.functionName,

        args: prepared.args as any,
        value: prepared.value,
        chainId: daoConfig.chainId,
      })
    } catch (err) {
      console.error('[coins] submit failed', err)
      setPrepError(parseError(err))
    } finally {
      setIsPreparing(false)
    }
  }

  const disabled =
    phase === 'preparing' || phase === 'sign' || phase === 'mine' || phase === 'done'
  const submitDisabled =
    !valid || !accepted || disabled || phase === 'error' || priceLoading || !!priceError

  if (phase === 'done' && expectedAddressRef.current) {
    return (
      <SuccessCard
        coinAddress={expectedAddressRef.current}
        txHash={receipt?.transactionHash as Hex | undefined}
        chainId={daoConfig.chainId}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface px-6 py-7">
      <div>
        <h2 className="text-xl font-bold">Create a coin</h2>
        <p className="mt-1 text-sm text-muted-fg">
          Deploy a Clanker token directly from your wallet — paired with WETH. You are the
          admin and rewards recipient. Anyone can deploy.
        </p>
      </div>

      <Field label="Name" hint={`${name.length}/50`}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 50))}
          placeholder="e.g. Community Coin"
          disabled={disabled}
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </Field>

      <Field label="Symbol" hint={`${symbol.length}/10`}>
        <input
          value={symbol}
          onChange={(e) =>
            setSymbol(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9$]/g, '')
                .slice(0, 10)
            )
          }
          placeholder="e.g. GNARS"
          disabled={disabled}
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-accent disabled:opacity-60"
        />
      </Field>

      <Field label="Description" hint={`${description.length}/500`}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="What is this coin about?"
          disabled={disabled}
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </Field>

      <Field label="Media">
        <MediaUploader value={media} onChange={setMedia} disabled={disabled} />
      </Field>

      <Field label="Backing currency">
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted-fg">
          Paired with <span className="font-semibold text-fg">WETH</span> on{' '}
          {CHAIN_NAMES[daoConfig.chainId] ?? `chain ${daoConfig.chainId}`}.
          {/* TODO: surface a radio to also pair with the DAO's clanker token
              when present (needs the clanker-token-price service). Tracked in
              BUILDER_REFERENCE.md → side backlog. */}
        </div>
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          disabled={disabled}
          className="mt-0.5"
        />
        <span className="text-[12.5px] leading-5 text-muted-fg">
          {COIN_DEPLOYMENT_DISCLAIMER}
        </span>
      </label>

      <div className="flex flex-col gap-3">
        {phase === 'connect' ? (
          <Button type="button" size="md" onClick={() => openConnectModal?.()}>
            Connect wallet
          </Button>
        ) : phase === 'switch' ? (
          <Button
            type="button"
            size="md"
            onClick={() => switchChain({ chainId: daoConfig.chainId })}
            disabled={isSwitching}
          >
            {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
            Switch to {CHAIN_NAMES[daoConfig.chainId] ?? `chain ${daoConfig.chainId}`}
          </Button>
        ) : (
          <Button
            type="button"
            size="md"
            onClick={submit}
            disabled={submitDisabled}
            className={cn('w-full')}
          >
            {phase === 'preparing' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading & preparing tx…
              </>
            )}
            {phase === 'sign' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirm in wallet…
              </>
            )}
            {phase === 'mine' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying coin…
              </>
            )}
            {(phase === 'idle' || phase === 'error') && 'Create coin'}
          </Button>
        )}

        {phase === 'error' && (
          <div className="text-[12.5px] text-destructive">
            {prepError ?? parseError(writeError ?? mineError)}
          </div>
        )}
        {priceError && phase !== 'error' && (
          <div className="text-[12.5px] text-destructive">
            Unable to fetch ETH price: {priceError.message}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold uppercase tracking-wider text-muted-fg">
          {label}
        </span>
        {hint && <span className="text-[11px] text-muted-fg">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SuccessCard({
  coinAddress,
  txHash,
  chainId,
}: {
  coinAddress: Address
  txHash?: Hex
  chainId: number
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-10 text-center">
      <h3 className="text-lg font-bold">Coin deployed ✓</h3>
      <p className="text-sm text-muted-fg">Redirecting to your new coin…</p>
      <div className="mx-auto flex flex-col gap-1 text-[12px] text-muted-fg">
        <div>
          Coin: <span className="font-mono">{coinAddress}</span>
        </div>
        {txHash && (
          <div>
            Tx: <span className="font-mono">{shorten(txHash)}</span>
          </div>
        )}
        <div>Chain: {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}</div>
      </div>
    </div>
  )
}

function shorten(hex: string) {
  if (!hex || hex.length < 12) return hex
  return `${hex.slice(0, 8)}…${hex.slice(-6)}`
}

function parseError(err: unknown): string {
  if (!err) return 'Something went wrong.'
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  return msg.split('\n')[0]
}
