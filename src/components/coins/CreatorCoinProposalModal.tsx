'use client'

import { WETH_ADDRESS } from '@buildeross/constants'
import { useEthUsdPrice } from '@buildeross/hooks'
import { uploadFile } from '@buildeross/ipfs-service'
import { governorAbi, tokenAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Address, formatEther, parseEther } from 'viem'
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { type MediaSelection, MediaUploader } from '@/components/coins/MediaUploader'
import { Button } from '@/components/ui/button'
import {
  buildCreatorCoinProposalPreview,
  buildCreatorCoinProposalTx,
  type CreatorCoinProposalTx,
} from '@/lib/creatorCoinProposal'
import { daoConfig } from '@/lib/dao.config'
import { composeDescription, parseWriteError } from '@/lib/proposal-validation'

type Props = {
  open: boolean
  onClose: () => void
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  8453: 'Base',
  84532: 'Base Sepolia',
}

export function CreatorCoinProposalModal({ open, onClose }: Props) {
  if (!open) return null
  return <ModalContent onClose={onClose} />
}

function ModalContent({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: daoConfig.chainId })
  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  // Coin identity (collected here, drives the prefill).
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [coinDescription, setCoinDescription] = useState('')
  const [media, setMedia] = useState<MediaSelection>(null)
  const [devBuyEth, setDevBuyEth] = useState('')

  // Proposal text — user overrides. The displayed value falls back to the
  // live preview (derived from the coin fields above) when these are empty
  // OR when the user hasn't typed in them yet. Once they start typing, their
  // text is treated as an override and auto-sync stops.
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalBody, setProposalBody] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [bodyTouched, setBodyTouched] = useState(false)

  const [accepted, setAccepted] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparedTx, setPreparedTx] = useState<CreatorCoinProposalTx | null>(null)

  // Eligibility (governor.proposalThreshold + token.balanceOf).
  const { data: eligibilityReads } = useReadContracts({
    contracts: address
      ? [
          {
            address: daoConfig.addresses.governor as Address,
            abi: governorAbi,
            functionName: 'proposalThreshold' as const,
            chainId: daoConfig.chainId,
          },
          {
            address: daoConfig.addresses.token as Address,
            abi: tokenAbi,
            functionName: 'balanceOf' as const,
            args: [address] as const,
            chainId: daoConfig.chainId,
          },
        ]
      : [],
    query: { enabled: !!address },
  })

  const proposalThreshold =
    eligibilityReads?.[0]?.status === 'success'
      ? Number(eligibilityReads[0].result as bigint)
      : 0
  const myBalance =
    eligibilityReads?.[1]?.status === 'success'
      ? Number(eligibilityReads[1].result as bigint)
      : 0
  const eligible = isConnected && myBalance > proposalThreshold

  const {
    price: ethUsdPrice,
    isLoading: priceLoading,
    error: priceError,
  } = useEthUsdPrice()

  // Treasury ETH balance — surfaced under "Initial purchase" so the proposer
  // can see what the DAO can afford to spend on deploy.
  const { data: treasuryBalance } = useBalance({
    address: daoConfig.addresses.treasury as Address,
    chainId: daoConfig.chainId,
  })

  const devBuyTooLarge = useMemo(() => {
    const parsed = parseOptionalEth(devBuyEth)
    if (!parsed || !treasuryBalance) return false
    return parsed > treasuryBalance.value
  }, [devBuyEth, treasuryBalance])
  const devBuyInvalid = devBuyEth.trim() !== '' && parseOptionalEth(devBuyEth) === null
  const devBuyNumber = useMemo(() => {
    const parsed = parseOptionalEth(devBuyEth)
    return parsed ? Number(formatEther(parsed)) : undefined
  }, [devBuyEth])

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
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: daoConfig.chainId })

  const handledRef = useRef(false)
  useEffect(() => {
    if (!isMined || handledRef.current) return
    handledRef.current = true
    const t = setTimeout(() => router.push('/proposals'), 1200)
    return () => clearTimeout(t)
  }, [isMined, router])

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

  const wethAddress = WETH_ADDRESS[daoConfig.chainId as keyof typeof WETH_ADDRESS] as
    | Address
    | undefined
  const valid = useMemo(
    () =>
      !!name.trim() &&
      !!symbol.trim() &&
      !!coinDescription.trim() &&
      !!media &&
      media.kind === 'image' &&
      !!wethAddress,
    [name, symbol, coinDescription, media, wethAddress]
  )

  // Live preview, recomputed whenever the coin fields above change. Sections
  // we don't have data for are omitted (no "(none)" placeholders, no empty
  // headings). When the user starts typing in the title/body fields the
  // `*Touched` flags flip on and we stop overwriting their text.
  const livePreview = useMemo(
    () =>
      buildCreatorCoinProposalPreview({
        name,
        symbol,
        description: coinDescription,
        treasury: daoConfig.addresses.treasury as Address,
        devBuyEth: devBuyNumber,
      }),
    [name, symbol, coinDescription, devBuyNumber]
  )

  const displayedTitle = titleTouched ? proposalTitle : livePreview.title
  const displayedBody = bodyTouched ? proposalBody : livePreview.description

  async function submit() {
    if (!valid || !address || !ethUsdPrice || !wethAddress) return
    resetWrite()
    setPrepError(null)

    if (!eligible) {
      setPrepError(
        `Not eligible to propose — you hold ${myBalance} ${myBalance === 1 ? 'token' : 'tokens'} (threshold ${proposalThreshold + 1}+).`
      )
      return
    }
    if (devBuyInvalid) {
      setPrepError('Initial purchase must be a valid ETH amount.')
      return
    }
    if (devBuyTooLarge || (devBuyNumber !== undefined && !treasuryBalance)) {
      setPrepError('Initial purchase cannot exceed the loaded treasury balance.')
      return
    }

    setIsPreparing(true)

    try {
      // 1. Upload image.
      const upload = await uploadFile(media!.file, { type: 'image' })

      // 2. Build the deploy tx (auto-fills title + description suggestions).
      const built = await buildCreatorCoinProposalTx(
        {
          treasury: daoConfig.addresses.treasury as Address,
          pairedToken: wethAddress,
          quoteTokenUsd: ethUsdPrice,
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          description: coinDescription.trim(),
          image: upload.uri,
          devBuyEth: devBuyNumber,
        },
        { publicClient: publicClient ?? undefined }
      )
      setPreparedTx(built)

      // Apply suggestions only to fields the user hasn't touched.
      const finalTitle = titleTouched ? proposalTitle : built.suggestedTitle
      const finalBody = bodyTouched ? proposalBody : built.suggestedDescription
      if (!titleTouched) setProposalTitle(built.suggestedTitle)
      if (!bodyTouched) setProposalBody(built.suggestedDescription)

      // 3. Submit governor.propose with the encoded creator-coin deploy tx.
      writeContract({
        address: daoConfig.addresses.governor as Address,
        abi: governorAbi,
        functionName: 'propose',
        args: [
          [built.target],
          [built.value],
          [built.calldata],
          composeDescription(finalTitle, finalBody),
        ],
        chainId: daoConfig.chainId,
      })
    } catch (err) {
      console.error('[creator-coin-proposal] failed', err)
      setPrepError(err instanceof Error ? err.message : 'Failed to build proposal')
    } finally {
      setIsPreparing(false)
    }
  }

  const disabled =
    phase === 'preparing' || phase === 'sign' || phase === 'mine' || phase === 'done'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-xl border border-border bg-surface shadow-2xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div>
            <h2 className="text-base font-bold">
              Propose a creator coin for {daoConfig.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-fg">
              Submits a proposal that, once executed, deploys a Clanker creator coin with
              the DAO treasury as admin and rewards recipient.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-fg hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
            disabled={disabled}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          {phase === 'done' ? (
            <SuccessPanel />
          ) : (
            <>
              <EligibilityRow
                connected={isConnected}
                eligible={eligible}
                balance={myBalance}
                threshold={proposalThreshold}
              />

              <Field label="Coin name" hint={`${name.length}/50`}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 50))}
                  placeholder="e.g. Builder Creator Coin"
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
                  placeholder="e.g. BLDR"
                  disabled={disabled}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-accent disabled:opacity-60"
                />
              </Field>

              <Field label="Coin description" hint={`${coinDescription.length}/500`}>
                <textarea
                  value={coinDescription}
                  onChange={(e) => setCoinDescription(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="What is this coin about?"
                  disabled={disabled}
                  className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60"
                />
              </Field>

              <Field label="Image">
                <MediaUploader value={media} onChange={setMedia} disabled={disabled} />
                {media && media.kind !== 'image' && (
                  <p className="mt-1 text-[11.5px] text-destructive">
                    Use an image for the creator coin (video upload is reserved for
                    content coins).
                  </p>
                )}
              </Field>

              <Field
                label="Initial purchase from treasury (optional)"
                hint={
                  treasuryBalance
                    ? `Treasury: ${formatTreasury(treasuryBalance.value)} ETH`
                    : 'ETH from treasury on deploy'
                }
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={devBuyEth}
                  onChange={(e) => setDevBuyEth(e.target.value.trim())}
                  placeholder="0"
                  disabled={disabled}
                  className={
                    'w-full rounded-md border bg-surface px-3 py-2.5 font-mono text-sm outline-none focus:border-accent disabled:opacity-60 ' +
                    (devBuyTooLarge || devBuyInvalid
                      ? 'border-destructive focus:border-destructive'
                      : 'border-border')
                  }
                />
                {devBuyInvalid && (
                  <p className="mt-1 text-[11.5px] text-destructive">
                    Enter a valid ETH amount.
                  </p>
                )}
                {devBuyTooLarge && treasuryBalance && (
                  <p className="mt-1 text-[11.5px] text-destructive">
                    Exceeds treasury balance ({formatTreasury(treasuryBalance.value)} ETH
                    available).
                  </p>
                )}
              </Field>

              <div className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-2.5">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-fg">
                  Proposal preview (editable)
                </div>
                <input
                  value={displayedTitle}
                  onChange={(e) => {
                    setProposalTitle(e.target.value)
                    setTitleTouched(true)
                  }}
                  placeholder="Type a coin name above to see the title fill in here"
                  disabled={disabled}
                  className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
                />
                <textarea
                  value={displayedBody}
                  onChange={(e) => {
                    setProposalBody(e.target.value)
                    setBodyTouched(true)
                  }}
                  rows={8}
                  placeholder="Fill the coin fields above to populate the description"
                  disabled={disabled}
                  className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-[12px] outline-none focus:border-accent disabled:opacity-60"
                />
                <p className="mt-2 text-[11.5px] text-muted-fg">
                  Live-filled from your coin fields. Anything you type here overrides it.
                </p>
              </div>

              {preparedTx && (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
                  <div className="font-semibold uppercase tracking-wider text-muted-fg">
                    Transaction (1 of 1)
                  </div>
                  <div className="mt-1.5 font-mono break-all">
                    <span className="text-muted-fg">target:</span> {preparedTx.target}
                  </div>
                  <div className="mt-1 font-mono">
                    <span className="text-muted-fg">value:</span>{' '}
                    {preparedTx.value === BigInt(0)
                      ? '0 ETH'
                      : `${Number(preparedTx.value) / 1e18} ETH`}
                  </div>
                  {preparedTx.expectedAddress && (
                    <div className="mt-1 font-mono break-all">
                      <span className="text-muted-fg">expected coin:</span>{' '}
                      {preparedTx.expectedAddress}
                    </div>
                  )}
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span className="text-[12.5px] leading-5 text-muted-fg">
                  I understand this proposal hands the DAO treasury control over a new
                  on-chain token. If executed, the coin&apos;s admin and rewards recipient
                  will be the DAO treasury permanently.
                </span>
              </label>

              {phase === 'connect' ? (
                <Button type="button" onClick={() => openConnectModal?.()}>
                  Connect wallet
                </Button>
              ) : phase === 'switch' ? (
                <Button
                  type="button"
                  onClick={() => switchChain({ chainId: daoConfig.chainId })}
                  disabled={isSwitching}
                >
                  {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Switch to{' '}
                  {CHAIN_NAMES[daoConfig.chainId] ?? `chain ${daoConfig.chainId}`}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={submit}
                  disabled={
                    !valid ||
                    !accepted ||
                    !eligible ||
                    !ethUsdPrice ||
                    priceLoading ||
                    !!priceError ||
                    devBuyInvalid ||
                    devBuyTooLarge ||
                    disabled ||
                    (devBuyNumber !== undefined && !treasuryBalance)
                  }
                  className="w-full"
                >
                  {phase === 'preparing' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading & preparing proposal…
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
                      Submitting on-chain…
                    </>
                  )}
                  {(phase === 'idle' || phase === 'error') && 'Submit proposal'}
                </Button>
              )}

              {phase === 'error' && (
                <div className="text-[12.5px] text-destructive">
                  {prepError ?? parseWriteError(writeError ?? mineError)}
                </div>
              )}
              {priceError && phase !== 'error' && (
                <div className="text-[12.5px] text-destructive">
                  Unable to fetch ETH price: {priceError.message}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTreasury(wei: bigint): string {
  const eth = parseFloat(formatEther(wei))
  if (!Number.isFinite(eth)) return '—'
  if (eth >= 1) return eth.toFixed(2)
  if (eth >= 0.001) return eth.toFixed(4)
  return eth.toExponential(2)
}

function parseOptionalEth(value: string): bigint | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    return parseEther(raw)
  } catch {
    return null
  }
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

function EligibilityRow({
  connected,
  eligible,
  balance,
  threshold,
}: {
  connected: boolean
  eligible: boolean
  balance: number
  threshold: number
}) {
  if (!connected) {
    return (
      <div className="rounded-md border border-accent/25 bg-accent/5 px-3 py-2 text-[12.5px]">
        Connect your wallet to check proposal eligibility.
      </div>
    )
  }
  if (eligible) {
    return (
      <div className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-[12.5px]">
        <strong className="font-semibold text-success">Eligible</strong> — you hold{' '}
        {balance} {balance === 1 ? 'token' : 'tokens'} (threshold {threshold}).
      </div>
    )
  }
  return (
    <div className="rounded-md border border-warning/25 bg-warning/5 px-3 py-2 text-[12.5px]">
      <strong className="font-semibold text-warning">Not eligible</strong> — you hold{' '}
      {balance} {balance === 1 ? 'token' : 'tokens'}; the proposal threshold is{' '}
      {threshold + 1}+.
    </div>
  )
}

function SuccessPanel() {
  return (
    <div className="rounded-md border border-success/25 bg-success/5 px-4 py-8 text-center">
      <h3 className="text-base font-bold">Proposal submitted ✓</h3>
      <p className="mt-1 text-[12.5px] text-muted-fg">
        Redirecting to the proposals list…
      </p>
    </div>
  )
}
