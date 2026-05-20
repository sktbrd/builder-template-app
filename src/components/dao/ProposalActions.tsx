'use client'

import { governorAbi } from '@buildeross/sdk/contract'
import { ProposalState } from '@buildeross/types'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type Address, type Hex, zeroAddress } from 'viem'
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
import type { ProposalStatus } from '@/lib/types'

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

// State/action matrix:
//
//   state       | queue | execute | cancel (proposer) | veto (vetoer) |
//   ------------+-------+---------+-------------------+---------------+
//   pending     |       |         |        ✓          |       ✓       |
//   active      |       |         |        ✓          |       ✓       |
//   succeeded   |   ✓   |         |        ✓          |       ✓       |
//   queued      |       |    ✓    |        ✓ *        |       ✓       |
//   defeated    |       |         |                   |               |
//   expired     |       |         |                   |               |
//   executed    |       |         |                   |               |
//   cancelled   |       |         |                   |               |
//   vetoed      |       |         |                   |               |
//
// * the governor contract permits cancel up until Executed; we keep it
// visible through Queued so a proposer can yank a queued proposal.
const QUEUE_STATES: ReadonlySet<ProposalStatus> = new Set(['succeeded'])
const EXECUTE_STATES: ReadonlySet<ProposalStatus> = new Set(['queued'])
const CANCEL_STATES: ReadonlySet<ProposalStatus> = new Set([
  'pending',
  'active',
  'succeeded',
  'queued',
])
const VETO_STATES: ReadonlySet<ProposalStatus> = new Set([
  'pending',
  'active',
  'succeeded',
  'queued',
])

function ProposalActionsInner({ detail }: Props) {
  const { address } = useAccount()

  // Action buttons should follow the governor's live state, not only the
  // server-rendered/subgraph status. The subgraph can lag after queue/execute,
  // which would otherwise leave users with buttons that immediately revert.
  const { data: liveState } = useReadContract({
    address: daoConfig.addresses.governor as Address,
    abi: governorAbi,
    functionName: 'state',
    args: [detail.proposalIdHash],
    chainId: daoConfig.chainId,
    query: { refetchInterval: 15_000 },
  })

  const status = mapLiveProposalState(liveState) ?? detail.summary.status

  // Vetoer is set at DAO deploy time and may be `0x0` (burned). Only read
  // when we'd otherwise render a veto button, to keep the page lighter.
  const vetoStateEligible = VETO_STATES.has(status)
  const { data: vetoer } = useReadContract({
    address: daoConfig.addresses.governor as Address,
    abi: governorAbi,
    functionName: 'vetoer',
    chainId: daoConfig.chainId,
    query: { enabled: vetoStateEligible },
  })

  const isProposer =
    !!address && address.toLowerCase() === detail.proposerFull.toLowerCase()
  const isVetoer =
    !!address &&
    !!vetoer &&
    (vetoer as string).toLowerCase() !== zeroAddress &&
    address.toLowerCase() === (vetoer as string).toLowerCase()

  const showQueue = QUEUE_STATES.has(status)
  const showExecute = EXECUTE_STATES.has(status)
  const showCancel = CANCEL_STATES.has(status) && isProposer
  const showVeto = vetoStateEligible && isVetoer

  // Skip the aside entirely if nothing applies. Avoids the empty-card bleed
  // for non-proposer non-vetoer viewers on pending/active proposals.
  if (!showQueue && !showExecute && !showCancel && !showVeto) return null

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-[22px]">
      {showQueue && <QueueAction detail={detail} />}
      {showExecute && <ExecuteAction detail={detail} />}
      {showCancel && <CancelAction detail={detail} />}
      {showVeto && <VetoAction detail={detail} />}
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
  const { data: eta, isLoading: etaLoading } = useReadContract({
    address: daoConfig.addresses.governor as Address,
    abi: governorAbi,
    functionName: 'proposalEta',
    args: [detail.proposalIdHash],
    chainId: daoConfig.chainId,
  })

  const etaSec = useMemo(() => (eta !== undefined ? Number(eta as bigint) : null), [eta])
  // Wait for the read to resolve before enabling the button — a missing eta
  // (read still in flight) would otherwise look "ready" and the tx would
  // revert from the governor side.
  const ready = etaSec !== null && etaSec > 0 && etaSec <= now
  const remaining = etaSec && etaSec > now ? etaSec - now : 0

  return (
    <ActionShell
      title="Execute proposal"
      blurb={
        etaLoading || etaSec === null
          ? 'Checking timelock…'
          : ready
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
  const { phase, run, error } = useGovernorWrite()

  return (
    <ActionShell
      title="Cancel proposal"
      blurb="As the proposer, you can withdraw this proposal at any time before execution."
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

// ── Veto ───────────────────────────────────────────────────────

function VetoAction({ detail }: { detail: ProposalDetail }) {
  const { phase, run, error } = useGovernorWrite()

  return (
    <ActionShell
      title="Veto proposal"
      blurb="As the DAO vetoer, you can override this proposal before execution."
      tone="destructive"
      phase={phase}
      error={error}
      idleLabel="Veto proposal"
      busyLabel="Vetoing…"
      onClick={() =>
        run({
          functionName: 'veto',
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

function mapLiveProposalState(state: unknown): ProposalStatus | null {
  if (state === undefined || state === null) return null
  switch (Number(state)) {
    case ProposalState.Pending:
      return 'pending'
    case ProposalState.Active:
      return 'active'
    case ProposalState.Canceled:
      return 'cancelled'
    case ProposalState.Defeated:
      return 'defeated'
    case ProposalState.Succeeded:
      return 'succeeded'
    case ProposalState.Queued:
      return 'queued'
    case ProposalState.Expired:
      return 'expired'
    case ProposalState.Executed:
      return 'executed'
    case ProposalState.Vetoed:
      return 'vetoed'
    default:
      return null
  }
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
