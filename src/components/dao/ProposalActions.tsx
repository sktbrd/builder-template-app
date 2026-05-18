'use client'

import { governorAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type Address, type Hex } from 'viem'
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
import type { ProposalDetail } from '@/lib/dao-data'

type Props = {
  detail: ProposalDetail
}

export function ProposalActions(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return <Skeleton />
  return <ProposalActionsInner {...props} />
}

function Skeleton() {
  return <div className="h-[160px] animate-pulse rounded-md bg-surface-2" />
}

function ProposalActionsInner({ detail }: Props) {
  const status = detail.summary.status

  const showQueue = status === 'succeeded'
  const showExecute = status === 'queued'
  // Cancel surfaces while the proposal can still be pulled by its proposer
  // — Builder governor allows cancel while pending/active/succeeded.
  // (Once queued/executed/cancelled/vetoed/defeated/expired we hide it.)
  const showCancel = status === 'pending' || status === 'active' || status === 'succeeded'

  if (!showQueue && !showExecute && !showCancel) return null

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-[22px]">
      {showQueue && <QueueAction detail={detail} />}
      {showExecute && <ExecuteAction detail={detail} />}
      {showCancel && <CancelAction detail={detail} />}
    </aside>
  )
}

// ── Queue ──────────────────────────────────────────────────────

function QueueAction({ detail }: { detail: ProposalDetail }) {
  const { phase, run, error } = useGovernorWrite()

  return (
    <ActionShell
      title="Queue proposal"
      blurb="This proposal passed. Queue it into the timelock — once the delay elapses, anyone can execute it."
      phase={phase}
      error={error}
      idleLabel="Queue proposal"
      busyLabel="Queuing…"
      onClick={() =>
        run({
          functionName: 'queue',
          args: [detail.proposalIdHash],
        })
      }
    />
  )
}

// ── Execute ────────────────────────────────────────────────────

function ExecuteAction({ detail }: { detail: ProposalDetail }) {
  const { phase, run, error } = useGovernorWrite()
  const now = useCountdownTick()

  // The timelock delay is set when queue() runs; we read it back from
  // proposalEta(...) to know when execute() will actually succeed.
  const { data: eta } = useReadContract({
    address: daoConfig.addresses.governor as Address,
    abi: governorAbi,
    functionName: 'proposalEta',
    args: [detail.proposalIdHash],
    chainId: daoConfig.chainId,
  })

  const etaSec = useMemo(() => (eta ? Number(eta as bigint) : 0), [eta])
  const ready = etaSec === 0 || etaSec <= now
  const remaining = etaSec > 0 ? Math.max(0, etaSec - now) : 0

  return (
    <ActionShell
      title="Execute proposal"
      blurb={
        ready
          ? 'Timelock elapsed. Execute the proposal to run its transactions.'
          : `Available in ${formatDuration(remaining)} once the timelock elapses.`
      }
      phase={phase}
      error={error}
      idleLabel="Execute proposal"
      busyLabel="Executing…"
      disabled={!ready}
      onClick={() => {
        const targets = detail.transactions.map((t) => t.target as Address)
        const values = detail.transactions.map((t) => t.valueWei)
        const calldatas = detail.transactions.map((t) => (t.calldata || '0x') as Hex)
        run({
          functionName: 'execute',
          args: [
            targets,
            values,
            calldatas,
            detail.descriptionHash,
            detail.proposerFull as Address,
          ],
        })
      }}
    />
  )
}

// ── Cancel ─────────────────────────────────────────────────────

function CancelAction({ detail }: { detail: ProposalDetail }) {
  const { address } = useAccount()
  const isProposer =
    !!address && address.toLowerCase() === detail.proposerFull.toLowerCase()

  const { phase, run, error } = useGovernorWrite()

  if (!isProposer) return null

  return (
    <ActionShell
      title="Cancel proposal"
      blurb="As the proposer, you can withdraw this proposal before it's queued."
      tone="destructive"
      phase={phase}
      error={error}
      idleLabel="Cancel proposal"
      busyLabel="Cancelling…"
      onClick={() =>
        run({
          functionName: 'cancel',
          args: [detail.proposalIdHash],
        })
      }
    />
  )
}

// ── Shared button shell ────────────────────────────────────────

type WritePhase = 'idle' | 'connect' | 'switch' | 'sign' | 'mine' | 'done' | 'error'

function ActionShell({
  title,
  blurb,
  phase,
  error,
  idleLabel,
  busyLabel,
  disabled,
  tone,
  onClick,
}: {
  title: string
  blurb: string
  phase: WritePhase
  error: string | null
  idleLabel: string
  busyLabel: string
  disabled?: boolean
  tone?: 'destructive'
  onClick: () => void
}) {
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="mt-1 text-[12.5px] text-muted-fg">{blurb}</p>
      </div>

      {phase === 'connect' ? (
        <Button onClick={() => openConnectModal?.()} className="w-full">
          Connect wallet
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
          onClick={onClick}
          disabled={disabled || phase === 'sign' || phase === 'mine'}
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
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
              {busyLabel}
            </>
          )}
          {phase === 'done' && 'Submitted ✓'}
          {(phase === 'idle' || phase === 'error') && idleLabel}
        </Button>
      )}

      {phase === 'error' && error && (
        <div className="text-[12.5px] text-destructive">{error}</div>
      )}
    </div>
  )
}

// ── Hook: shared write phase machine ───────────────────────────

type GovernorFunction = 'queue' | 'execute' | 'cancel' | 'veto'

type GovernorRunArgs =
  | { functionName: 'queue' | 'cancel' | 'veto'; args: readonly [`0x${string}`] }
  | {
      functionName: 'execute'
      args: readonly [Address[], bigint[], Hex[], `0x${string}`, Address]
    }

function useGovernorWrite(): {
  phase: WritePhase
  run: (call: GovernorRunArgs) => void
  error: string | null
} {
  const { isConnected } = useAccount()
  const connectedChainId = useChainId()
  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract()

  const {
    isLoading: isMining,
    isSuccess: isMined,
    error: mineError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // Reset after success so the panel becomes interactive again if the user
  // wants to do something else (e.g. cancel after queue).
  useEffect(() => {
    if (!isMined) return
    const t = setTimeout(() => reset(), 2400)
    return () => clearTimeout(t)
  }, [isMined, reset])

  const phase: WritePhase = !isConnected
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

  const run = (call: GovernorRunArgs) => {
    const base = {
      address: daoConfig.addresses.governor as Address,
      abi: governorAbi,
      chainId: daoConfig.chainId,
    } as const
    if (call.functionName === 'execute') {
      writeContract({
        ...base,
        functionName: 'execute',
        args: call.args,
      })
    } else {
      writeContract({
        ...base,
        functionName: call.functionName as GovernorFunction,
        args: call.args,
      })
    }
  }

  return { phase, run, error: parseWriteError(writeError ?? mineError) }
}

function parseWriteError(err: unknown): string | null {
  if (!err) return null
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  return msg.split('\n')[0]
}

function formatDuration(sec: number): string {
  if (sec <= 0) return 'now'
  const d = Math.floor(sec / 86400)
  if (d >= 1) return `${d}d`
  const h = Math.floor(sec / 3600)
  if (h >= 1) return `${h}h`
  const m = Math.floor(sec / 60)
  if (m >= 1) return `${m}m`
  return `${sec}s`
}

// Tiny re-tick so the "Available in 2h" copy updates without a hard refresh.
function useCountdownTick(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}
