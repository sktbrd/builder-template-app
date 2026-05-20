'use client'

import { COIN_DEPLOYMENT_DISCLAIMER } from '@buildeross/constants'
import { useClankerTokensFull } from '@buildeross/hooks'
import { uploadFile } from '@buildeross/ipfs-service'
import { isChainIdSupportedByCoining } from '@buildeross/utils'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import {
  createMetadataBuilder,
  type Uploader,
  type UploadResult,
} from '@zoralabs/coins-sdk'
import { ChevronLeft, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { CreatorCoinProposalModal } from '@/components/coins/CreatorCoinProposalModal'
import { type MediaSelection, MediaUploader } from '@/components/coins/MediaUploader'
import { Button } from '@/components/ui/button'
import { buildContentCoinDeployTx } from '@/lib/contentCoin'
import { daoConfig } from '@/lib/dao.config'
import { useClankerTokenUsdPrice } from '@/lib/useClankerTokenUsdPrice'
import { cn } from '@/lib/utils'

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  84532: 'Base Sepolia',
}

/**
 * Wraps `@buildeross/ipfs-service`'s `uploadFile` so the Zora SDK metadata
 * builder can pipe images / videos / JSON through our Pinata routes.
 */
class IPFSUploader implements Uploader {
  async upload(file: File): Promise<UploadResult> {
    const res = await uploadFile(file)
    return {
      url: res.uri as `ipfs://${string}`,
      size: file.size,
      mimeType: file.type || undefined,
    }
  }
}

export function CoinCreateForm() {
  const ready = useWeb3Ready()
  if (!ready) return <Skeleton />

  if (!isChainIdSupportedByCoining(daoConfig.chainId)) {
    return (
      <Notice
        title="Coins are not supported on this chain"
        body="Builder's Zora content-coin factory is only deployed on Base and Base Sepolia today."
      />
    )
  }

  return <CoinCreateFormInner />
}

function Skeleton() {
  return <div className="h-[680px] animate-pulse rounded-xl bg-surface-2" />
}

function CoinCreateFormInner() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: daoConfig.chainId })

  // 1. The DAO must already have a clanker creator coin — that's the only
  // currency the content-coin factory accepts here (and the only way the
  // subgraph can associate the new content coin back to a DAO).
  const { data: clankerTokens, isLoading: clankerLoading } = useClankerTokensFull({
    chainId: daoConfig.chainId,
    collectionAddress: daoConfig.addresses.token,
    enabled: true,
    first: 1,
  })
  const latestClankerToken = useMemo(
    () => (clankerTokens && clankerTokens.length > 0 ? clankerTokens[0] : null),
    [clankerTokens]
  )

  const {
    priceUsd: clankerTokenPriceUsd,
    isLoading: priceLoading,
    error: priceError,
  } = useClankerTokenUsdPrice(latestClankerToken)

  // 2. Form state.
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [media, setMedia] = useState<MediaSelection>(null)
  const [accepted, setAccepted] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  const expectedAddressRef = useRef<Address | null>(null)
  const handledTxRef = useRef<Hex | undefined>(undefined)

  // 3. wagmi write + receipt.
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

  // After mine → navigate to /coins/[expectedAddress]. Refs (not state) keep
  // the timer from being torn down by re-renders.
  useEffect(() => {
    if (!isMined || !receipt) return
    const tx = receipt.transactionHash as Hex
    if (handledTxRef.current === tx) return
    handledTxRef.current = tx
    const target = expectedAddressRef.current
    const t = setTimeout(() => {
      router.push(target ? `/coins/${target}` : '/coins')
    }, 1200)
    return () => clearTimeout(t)
  }, [isMined, receipt, router])

  // 4. Gating states (render-time short-circuits).
  if (clankerLoading) {
    return <Skeleton />
  }

  if (!latestClankerToken) {
    return <NoCreatorCoinBlocker />
  }

  const valid = !!name.trim() && !!symbol.trim() && !!description.trim() && !!media

  async function submit() {
    if (!valid || !address || !latestClankerToken || !publicClient) return
    resetWrite()
    setPrepError(null)

    if (!clankerTokenPriceUsd) {
      setPrepError('Waiting on clanker token price — try again in a moment.')
      return
    }

    setIsPreparing(true)

    try {
      // a) Upload primary media to IPFS.
      const isMediaImage = media!.kind === 'image'
      const primary = await uploadFile(media!.file, {
        type: isMediaImage ? 'image' : 'media',
      })

      // b) Build metadata via Zora's builder (matches apps/web's pattern).
      const builder = createMetadataBuilder()
        .withName(name.trim())
        .withSymbol(symbol.trim().toUpperCase())
        .withDescription(description.trim())

      if (isMediaImage) {
        builder.withImageURI(primary.uri)
      } else {
        // Video: thumbnail = image, video = animation_url.
        const thumb = await uploadFile((media as { thumbnail: File }).thumbnail, {
          type: 'image',
        })
        builder.withImageURI(thumb.uri)
        builder.withMediaURI(primary.uri, media!.mimeType)
      }

      // c) Upload the metadata JSON itself.
      const { url: metadataUri } = await builder.upload(new IPFSUploader())

      // d) Build the wagmi `writeContract` args.
      const deployTx = buildContentCoinDeployTx({
        user: address,
        currency: latestClankerToken!.tokenAddress as Address,
        clankerTokenPriceUsd,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        metadataUri,
      })

      // e) Predict the CREATE2 address before sending the tx so the success
      // path can deep-link straight to /coins/[address].
      try {
        const predicted = await publicClient.readContract({
          address: deployTx.target,
          abi: deployTx.abi,
          functionName: 'coinAddress',
          args: [
            address,
            name.trim(),
            symbol.trim().toUpperCase(),
            deployTx.args[5], // poolConfig
            deployTx.args[6], // platformReferrer
            deployTx.args[9], // coinSalt
          ],
        })
        expectedAddressRef.current = predicted as Address
      } catch (err) {
        // Prediction is a nice-to-have. If it fails we still land on /coins.
        console.warn('[coins] coinAddress prediction failed', err)
      }

      // f) Hand off to wagmi.

      writeContract({
        address: deployTx.target,

        abi: deployTx.abi as any,
        functionName: deployTx.functionName,

        args: deployTx.args as any,
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
    !valid ||
    !accepted ||
    disabled ||
    priceLoading ||
    !!priceError ||
    !clankerTokenPriceUsd

  if (phase === 'done') {
    return (
      <SuccessCard
        coinAddress={expectedAddressRef.current}
        txHash={receipt?.transactionHash as Hex | undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface px-6 py-7">
      <div>
        <h2 className="text-xl font-bold">Create a coin</h2>
        <p className="mt-1 text-sm text-muted-fg">
          Deploy a Zora content coin directly from your wallet — paired with{' '}
          <span className="font-semibold text-fg">${latestClankerToken.tokenSymbol}</span>
          , {daoConfig.name}&apos;s creator coin. You are the payout recipient; the DAO
          treasury is a co-owner so it can update metadata after deploy.
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
          placeholder="e.g. COMM"
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
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[13px]">
          <div className="text-muted-fg">
            Paired with{' '}
            <span className="font-semibold text-fg">
              ${latestClankerToken.tokenSymbol}
            </span>{' '}
            ({latestClankerToken.tokenName}) on{' '}
            {CHAIN_NAMES[daoConfig.chainId] ?? `chain ${daoConfig.chainId}`}
          </div>
          {priceLoading && (
            <div className="text-[12px] text-muted-fg">Fetching token price…</div>
          )}
          {priceError && (
            <div className="text-[12px] text-destructive">{priceError.message}</div>
          )}
          {clankerTokenPriceUsd != null && (
            <div className="text-[12px] text-muted-fg">
              Current price: ${clankerTokenPriceUsd.toPrecision(4)} per token
            </div>
          )}
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
      </div>
    </div>
  )
}

function NoCreatorCoinBlocker() {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
        <h3 className="text-base font-bold">
          {daoConfig.name} doesn&apos;t have a creator coin yet
        </h3>
        <p className="text-sm text-muted-fg">
          Content coins on this surface pair with the DAO&apos;s clanker creator coin (so
          the DAO gets paired-token rewards on every trade). The DAO needs to deploy one
          first — via a proposal — before anyone can create a content coin here.
        </p>
        <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
            Propose a creator coin
          </Button>
          <a href="https://docs.nouns.build/" target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
              Docs
            </Button>
          </a>
        </div>
      </div>
      <CreatorCoinProposalModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
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
}: {
  coinAddress: Address | null
  txHash: Hex | undefined
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-6 py-10 text-center">
      <h3 className="text-lg font-bold">Coin deployed ✓</h3>
      <p className="text-sm text-muted-fg">Redirecting…</p>
      <div className="mx-auto flex flex-col gap-1 text-[12px] text-muted-fg">
        {coinAddress && (
          <div>
            Coin: <span className="font-mono">{coinAddress}</span>
          </div>
        )}
        {txHash && (
          <div>
            Tx: <span className="font-mono">{shorten(txHash)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-6 py-10 text-center">
      <h3 className="text-base font-bold">{title}</h3>
      <p className="text-sm text-muted-fg">{body}</p>
      <div className="mx-auto mt-2">
        <Link
          href="/coins"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All coins
        </Link>
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
