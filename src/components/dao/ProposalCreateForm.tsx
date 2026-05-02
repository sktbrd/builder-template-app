'use client'

import { governorAbi, tokenAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ChevronLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { type Address, isAddress, parseEther } from 'viem'
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import {
  composeDescription,
  isHex,
  parseWriteError,
  type Tx,
  validate,
} from '@/lib/proposal-validation'

const EMPTY_TX: Tx = { target: '', valueEth: '0', calldata: '0x' }

export function ProposalCreateForm() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [txs, setTxs] = useState<Tx[]>([{ ...EMPTY_TX }])
  const [showPreview, setShowPreview] = useState(false)

  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  // Eligibility: governor.proposalThreshold + token.balanceOf(account).
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

  // proposalThreshold is "minimum tokens > threshold" by Builder convention,
  // so eligibility is balance > threshold (strict gt, not gte). We keep gte
  // as a friendlier UX — invalid proposes will revert anyway.
  const eligible = isConnected && myBalance > proposalThreshold

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract()
  const {
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // After successful submission, send the user back to /proposals — the
  // new proposalNumber isn't in the receipt directly (it lives in the
  // ProposalCreated event); the list will auto-revalidate within 60s.
  useEffect(() => {
    if (!isMined) return
    const t = setTimeout(() => {
      router.push('/proposals')
    }, 1600)
    return () => clearTimeout(t)
  }, [isMined, router])

  const validation = useMemo(
    () => validate(title, description, txs),
    [title, description, txs]
  )

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
    if (!validation.ok) return
    let valuesWei: bigint[]
    try {
      valuesWei = txs.map((t) => (t.valueEth.trim() ? parseEther(t.valueEth) : BigInt(0)))
    } catch {
      return
    }
    const targets = txs.map((t) => t.target as Address)
    const calldatas = txs.map((t) => (t.calldata?.trim() || '0x') as `0x${string}`)
    const fullDescription = composeDescription(title, description)

    writeContract({
      address: daoConfig.addresses.governor as Address,
      abi: governorAbi,
      functionName: 'propose',
      args: [targets, valuesWei, calldatas, fullDescription],
    })
  }

  const updateTx = (i: number, patch: Partial<Tx>) =>
    setTxs((prev) => prev.map((t, j) => (i === j ? { ...t, ...patch } : t)))
  const addTx = () => setTxs((prev) => [...prev, { ...EMPTY_TX }])
  const removeTx = (i: number) =>
    setTxs((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => i !== j)))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All proposals
        </Link>
      </div>

      <div>
        <h1 className="font-display text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
          New proposal
        </h1>
        <p className="mt-1 text-muted-fg">
          Submit a proposal to the {daoConfig.name} DAO governor.
        </p>
      </div>

      {/* Eligibility banner */}
      <EligibilityBanner
        connected={isConnected}
        eligible={eligible}
        balance={myBalance}
        threshold={proposalThreshold}
      />

      {/* Title */}
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <label className="block text-base font-bold">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short, action-oriented title"
          className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-base font-bold">Description</label>
          <div className="flex gap-1 rounded-md border border-border bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={
                !showPreview
                  ? 'rounded-sm bg-surface px-2.5 py-1 text-[12px] font-semibold text-fg shadow-sm'
                  : 'rounded-sm px-2.5 py-1 text-[12px] font-medium text-muted-fg hover:text-fg'
              }
            >
              Edit
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
        {showPreview ? (
          <div className="mt-4 min-h-[160px] rounded-md border border-dashed border-border bg-surface-2 px-4 py-3">
            {description ? (
              <Markdown>{description}</Markdown>
            ) : (
              <div className="text-sm text-muted-fg">Nothing to preview yet.</div>
            )}
          </div>
        ) : (
          <textarea
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Markdown supported — headings, lists, links, code, tables…"
            className="mt-3 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accent"
          />
        )}
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Transactions</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-fg">
              Each call the proposal executes on success. Use empty calldata (0x) and a
              non-zero value to send ETH.
            </p>
          </div>
          <Button variant="secondary" onClick={addTx} className="self-start">
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {txs.map((tx, i) => (
            <li
              key={i}
              className="rounded-md border border-border bg-surface-2 px-4 py-3"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]">
                <Field label="Target address">
                  <input
                    type="text"
                    value={tx.target}
                    onChange={(e) => updateTx(i, { target: e.target.value })}
                    placeholder="0x…"
                    className={textInputClass(
                      tx.target.length > 0 && !isAddress(tx.target)
                    )}
                  />
                </Field>
                <Field label="Value (ETH)">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tx.valueEth}
                    onChange={(e) => updateTx(i, { valueEth: e.target.value })}
                    placeholder="0"
                    className={textInputClass(false)}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeTx(i)}
                  disabled={txs.length === 1}
                  aria-label="Remove transaction"
                  className="self-end rounded-md border border-border bg-surface px-3 py-2 text-muted-fg hover:bg-surface-3 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Field label="Calldata (hex)">
                <input
                  type="text"
                  value={tx.calldata}
                  onChange={(e) => updateTx(i, { calldata: e.target.value })}
                  placeholder="0x"
                  className={textInputClass(!!tx.calldata && !isHex(tx.calldata))}
                />
              </Field>
            </li>
          ))}
        </ul>
      </div>

      {/* Validation summary + submit */}
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        {validation.errors.length > 0 && (
          <ul className="mb-3 list-disc pl-5 text-[13px] text-warning">
            {validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {phase === 'connect' ? (
          <Button onClick={() => openConnectModal?.()} className="w-full">
            Connect wallet to propose
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
            disabled={!validation.ok || !eligible || phase === 'sign' || phase === 'mine'}
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
                Submitting on-chain…
              </>
            )}
            {phase === 'done' && 'Proposal submitted ✓'}
            {(phase === 'idle' || phase === 'error') && 'Submit proposal'}
          </Button>
        )}
        {phase === 'error' && (
          <div className="mt-2 text-[12.5px] text-destructive">
            {parseWriteError(writeError ?? mineError)}
          </div>
        )}
      </div>
    </div>
  )
}

function EligibilityBanner({
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
      <div className="rounded-md border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
        <strong className="font-semibold">Connect your wallet</strong> to check proposal
        eligibility.
      </div>
    )
  }
  if (eligible) {
    return (
      <div className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm">
        <strong className="font-semibold text-success">Eligible</strong> — you hold{' '}
        {balance} {balance === 1 ? 'token' : 'tokens'} (threshold: {threshold}).
      </div>
    )
  }
  return (
    <div className="rounded-md border border-warning/25 bg-warning/5 px-4 py-3 text-sm">
      <strong className="font-semibold text-warning">Not eligible</strong> — you hold{' '}
      {balance} {balance === 1 ? 'token' : 'tokens'}; the proposal threshold is{' '}
      {threshold + 1}+.
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <span className="block text-[12.5px] text-muted-fg">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function textInputClass(error: boolean): string {
  return [
    'w-full rounded-md border bg-surface px-3 py-2 font-mono text-xs outline-none',
    error ? 'border-warning focus:border-warning' : 'border-border focus:border-accent',
  ].join(' ')
}

