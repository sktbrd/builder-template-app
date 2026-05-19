'use client'

import { erc20Abi, governorAbi, tokenAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { type Address, parseEther } from 'viem'
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import {
  emptyDraft,
  encodeDraft,
  tokenKey,
  type TokenMetaMap,
  type TxDraft,
  type TxKind,
  uniqueErc20Tokens,
  validateDraft,
} from '@/lib/proposal-tx'
import { composeDescription, parseWriteError } from '@/lib/proposal-validation'

import { DraftForm } from './ProposalCreate/DraftForm'
import { Review } from './ProposalCreate/Review'
import { SummaryCard } from './ProposalCreate/SummaryCard'
import { TypeCard } from './ProposalCreate/TypeCard'
import { type WizardStep, WizardTabs } from './ProposalCreate/WizardTabs'

const KINDS: TxKind[] = ['eth', 'erc20', 'custom']

export function ProposalCreateForm() {
  const ready = useWeb3Ready()
  if (!ready) return <ProposalCreateFormSkeleton />
  return <ProposalCreateFormInner />
}

function ProposalCreateFormSkeleton() {
  return <div className="h-[400px] animate-pulse rounded-md bg-surface-2" />
}

type EditorState =
  | { mode: 'list' }
  | { mode: 'new'; draft: TxDraft }
  | { mode: 'edit'; index: number; draft: TxDraft }

function ProposalCreateFormInner() {
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drafts, setDrafts] = useState<TxDraft[]>([])
  const [editor, setEditor] = useState<EditorState>({ mode: 'list' })
  const [showPreview, setShowPreview] = useState(false)

  const { address, isConnected } = useAccount()
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  // ── Eligibility (token balance vs governor proposalThreshold)
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

  // ── Token metadata for ERC-20 drafts: treasury list is free, custom tokens
  //    read decimals + symbol on-chain via wagmi.
  const treasuryMeta = useMemo<TokenMetaMap>(() => {
    const m: TokenMetaMap = {}
    for (const t of daoConfig.treasuryTokens) {
      m[tokenKey(t.address)] = { decimals: t.decimals, symbol: t.symbol }
    }
    return m
  }, [])

  const draftsForMeta = useMemo(() => {
    const all: TxDraft[] = [...drafts]
    if (editor.mode !== 'list') all.push(editor.draft)
    return all
  }, [drafts, editor])

  const customTokens = useMemo(() => {
    const treasurySet = new Set(daoConfig.treasuryTokens.map((t) => tokenKey(t.address)))
    return uniqueErc20Tokens(draftsForMeta).filter((a) => !treasurySet.has(tokenKey(a)))
  }, [draftsForMeta])

  const tokenReadContracts = useMemo(
    () =>
      customTokens.flatMap((addr) => [
        {
          address: addr,
          abi: erc20Abi,
          functionName: 'decimals' as const,
          chainId: daoConfig.chainId,
        },
        {
          address: addr,
          abi: erc20Abi,
          functionName: 'symbol' as const,
          chainId: daoConfig.chainId,
        },
      ]),
    [customTokens]
  )

  const { data: tokenReads } = useReadContracts({
    contracts: tokenReadContracts,
    query: { enabled: tokenReadContracts.length > 0 },
  })

  const tokenMeta = useMemo<TokenMetaMap>(() => {
    const m: TokenMetaMap = { ...treasuryMeta }
    customTokens.forEach((addr, i) => {
      const dec = tokenReads?.[i * 2]
      const sym = tokenReads?.[i * 2 + 1]
      if (dec?.status === 'success') {
        const decimals = Number(dec.result as number | bigint)
        const symbol = sym?.status === 'success' ? (sym.result as string) : undefined
        m[tokenKey(addr)] = { decimals, symbol }
      }
    })
    return m
  }, [treasuryMeta, customTokens, tokenReads])

  // ── Step-readiness rules
  const detailsValid = title.trim().length > 0 && description.trim().length > 0
  const transactionsValid =
    drafts.length > 0 && drafts.every((d) => validateDraft(d, tokenMeta).length === 0)

  const unlocked: Record<WizardStep, boolean> = {
    details: true,
    transactions: detailsValid,
    preview: detailsValid && transactionsValid,
  }

  // ── Submit
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

  useEffect(() => {
    if (!isMined) return
    const t = setTimeout(() => {
      router.push('/proposals')
    }, 1600)
    return () => clearTimeout(t)
  }, [isMined, router])

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
    if (!detailsValid || !transactionsValid) return
    const encoded = drafts.map((d) => encodeDraft(d, tokenMeta))
    if (encoded.some((e) => e === null)) return
    let valuesWei: bigint[]
    try {
      valuesWei = encoded.map((e) =>
        e!.valueEth.trim() ? parseEther(e!.valueEth) : BigInt(0)
      )
    } catch {
      return
    }
    const targets = encoded.map((e) => e!.target as Address)
    const calldatas = encoded.map((e) => (e!.calldata?.trim() || '0x') as `0x${string}`)
    const fullDescription = composeDescription(title, description)

    writeContract({
      address: daoConfig.addresses.governor as Address,
      abi: governorAbi,
      functionName: 'propose',
      args: [targets, valuesWei, calldatas, fullDescription],
    })
  }

  // ── Editor helpers
  const openNew = (kind: TxKind) => setEditor({ mode: 'new', draft: emptyDraft(kind) })
  const openEdit = (i: number) => setEditor({ mode: 'edit', index: i, draft: drafts[i] })
  const cancelEdit = () => setEditor({ mode: 'list' })
  const saveEdit = () => {
    if (editor.mode === 'new') {
      setDrafts((prev) => [...prev, editor.draft])
    } else if (editor.mode === 'edit') {
      setDrafts((prev) => prev.map((d, j) => (j === editor.index ? editor.draft : d)))
    }
    setEditor({ mode: 'list' })
  }
  const removeDraft = (i: number) => setDrafts((prev) => prev.filter((_, j) => j !== i))
  const setEditorDraft = (next: TxDraft) =>
    setEditor((cur) => (cur.mode === 'list' ? cur : { ...cur, draft: next }))

  // ── Navigation
  const goNext = () => {
    if (step === 'details' && unlocked.transactions) setStep('transactions')
    else if (step === 'transactions' && unlocked.preview) setStep('preview')
  }
  const goBack = () => {
    if (step === 'transactions') setStep('details')
    else if (step === 'preview') setStep('transactions')
  }

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

      <EligibilityBanner
        connected={isConnected}
        eligible={eligible}
        balance={myBalance}
        threshold={proposalThreshold}
      />

      <WizardTabs current={step} onChange={setStep} unlocked={unlocked} />

      {step === 'details' && (
        <DetailsStep
          title={title}
          description={description}
          showPreview={showPreview}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onTogglePreview={setShowPreview}
        />
      )}

      {step === 'transactions' && (
        <TransactionsStep
          drafts={drafts}
          tokenMeta={tokenMeta}
          editor={editor}
          onOpenNew={openNew}
          onOpenEdit={openEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onRemove={removeDraft}
          onEditorChange={setEditorDraft}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          title={title}
          description={description}
          drafts={drafts}
          tokenMeta={tokenMeta}
        />
      )}

      <StepFooter
        step={step}
        unlocked={unlocked}
        editing={editor.mode !== 'list'}
        eligible={eligible}
        phase={phase}
        isSwitching={isSwitching}
        onBack={goBack}
        onNext={goNext}
        onConnect={() => openConnectModal?.()}
        onSwitch={() => switchChain({ chainId: daoConfig.chainId })}
        onSubmit={submit}
        writeError={writeError}
        mineError={mineError}
      />
    </div>
  )
}

function DetailsStep({
  title,
  description,
  showPreview,
  onTitleChange,
  onDescriptionChange,
  onTogglePreview,
}: {
  title: string
  description: string
  showPreview: boolean
  onTitleChange: (s: string) => void
  onDescriptionChange: (s: string) => void
  onTogglePreview: (b: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <label className="block text-base font-bold">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="A short, action-oriented title"
          className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          maxLength={200}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-base font-bold">Description</label>
          <div className="flex gap-1 rounded-md border border-border bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => onTogglePreview(false)}
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
              onClick={() => onTogglePreview(true)}
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
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Markdown supported — headings, lists, links, code, tables…"
            className="mt-3 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-[13px] outline-none focus:border-accent"
          />
        )}
      </div>
    </div>
  )
}

function TransactionsStep({
  drafts,
  tokenMeta,
  editor,
  onOpenNew,
  onOpenEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  onEditorChange,
}: {
  drafts: TxDraft[]
  tokenMeta: TokenMetaMap
  editor: EditorState
  onOpenNew: (kind: TxKind) => void
  onOpenEdit: (i: number) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onRemove: (i: number) => void
  onEditorChange: (next: TxDraft) => void
}) {
  if (editor.mode !== 'list') {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <DraftForm
          draft={editor.draft}
          onChange={onEditorChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          tokenMeta={tokenMeta}
          saveLabel={editor.mode === 'edit' ? 'Save changes' : 'Add to queue'}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
        <h3 className="text-base font-bold">Add a transaction</h3>
        <p className="mt-1 text-[12.5px] text-muted-fg">
          Each call the proposal executes if it passes. Pick a type to start.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {KINDS.map((k) => (
            <TypeCard key={k} kind={k} onSelect={() => onOpenNew(k)} />
          ))}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
          <h3 className="text-base font-bold">
            Queue{' '}
            <span className="ml-1 text-[12.5px] font-normal text-muted-fg">
              {drafts.length}
            </span>
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((d, i) => (
              <li key={i}>
                <SummaryCard
                  draft={d}
                  index={i}
                  tokenMeta={tokenMeta}
                  onEdit={() => onOpenEdit(i)}
                  onRemove={() => onRemove(i)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PreviewStep({
  title,
  description,
  drafts,
  tokenMeta,
}: {
  title: string
  description: string
  drafts: TxDraft[]
  tokenMeta: TokenMetaMap
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
      <Review
        title={title}
        description={description}
        drafts={drafts}
        tokenMeta={tokenMeta}
      />
    </div>
  )
}

function StepFooter({
  step,
  unlocked,
  editing,
  eligible,
  phase,
  isSwitching,
  onBack,
  onNext,
  onConnect,
  onSwitch,
  onSubmit,
  writeError,
  mineError,
}: {
  step: WizardStep
  unlocked: Record<WizardStep, boolean>
  editing: boolean
  eligible: boolean
  phase: 'connect' | 'switch' | 'sign' | 'mine' | 'done' | 'error' | 'idle'
  isSwitching: boolean
  onBack: () => void
  onNext: () => void
  onConnect: () => void
  onSwitch: () => void
  onSubmit: () => void
  writeError: unknown
  mineError: unknown
}) {
  // While editing a transaction the focused form owns its own Save/Cancel.
  if (step === 'transactions' && editing) return null

  const isPreview = step === 'preview'

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-[22px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={step === 'details'}
          className="w-full sm:w-auto"
        >
          Back
        </Button>

        {!isPreview ? (
          <Button
            onClick={onNext}
            disabled={!unlocked[step === 'details' ? 'transactions' : 'preview']}
            className="w-full sm:w-auto"
          >
            {step === 'details' ? 'Next: Transactions' : 'Next: Preview'}
          </Button>
        ) : phase === 'connect' ? (
          <Button onClick={onConnect} className="w-full sm:w-auto">
            Connect wallet to propose
          </Button>
        ) : phase === 'switch' ? (
          <Button onClick={onSwitch} className="w-full sm:w-auto" disabled={isSwitching}>
            {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
            Switch network
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={!eligible || phase === 'sign' || phase === 'mine'}
            className="w-full sm:w-auto"
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
      </div>
      {isPreview && phase === 'error' && (
        <div className="mt-2 text-[12.5px] text-destructive">
          {parseWriteError(writeError ?? mineError)}
        </div>
      )}
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
