'use client'

import { useEnsName } from '@buildeross/hooks/useEnsName'
import { governorAbi, tokenAbi } from '@buildeross/sdk/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'

import { useWeb3Ready } from '@/app/web3-providers'
import {
  VotingPowerExplainer,
  type VotingPowerScenario,
} from '@/components/dao/VotingPowerExplainer'
import { WalletPill } from '@/components/dao/WalletPill'
import { Button } from '@/components/ui/button'
import { daoConfig } from '@/lib/dao.config'
import { cn } from '@/lib/utils'

type Choice = 'for' | 'against' | 'abstain'

const SUPPORT: Record<Choice, number> = {
  against: 0,
  for: 1,
  abstain: 2,
}

type Props = {
  proposalIdHash: `0x${string}`
  /** Unix timestamp when voting opens — passed to governor.getVotes(account, timestamp). */
  voteStart: number
  initialChoice?: Choice | null
  /** Whether voting is open (proposal is in active state). */
  active?: boolean
}

export function VotePanel(props: Props) {
  const ready = useWeb3Ready()
  if (!ready) return <VotePanelSkeleton />
  return <VotePanelInner {...props} />
}

function VotePanelSkeleton() {
  // Mirror the real aside shell so the panel mount doesn't cause a layout
  // jump (border / sticky-offset / height all align with VotePanelInner).
  return (
    <div className="h-[380px] animate-pulse rounded-xl border border-border bg-surface px-6 py-[22px] lg:sticky lg:top-20" />
  )
}

function VotePanelInner({
  proposalIdHash,
  voteStart,
  initialChoice = null,
  active = true,
}: Props) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice)
  const [reason, setReason] = useState('')

  const { address, isConnected } = useAccount()
  const { ensName } = useEnsName(address)
  const connectedChainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const onWrongChain = isConnected && connectedChainId !== daoConfig.chainId

  // Resolve real voting power: getVotes at the proposal's snapshot timestamp +
  // current token balance (to distinguish "delegated away" from "no tokens").
  const nowSec = Math.floor(Date.now() / 1000)
  const snapshotInPast = voteStart > 0 && voteStart <= nowSec
  // `pending` covers the gap between proposal creation and voteStart: the
  // governor reverts on getPastVotes for a future timestamp, so we can't infer
  // a real scenario — render a "voting opens in X" callout instead of the
  // misleading "you held 0 tokens at the snapshot block" fallback.
  const pending = voteStart > 0 && voteStart > nowSec

  const { data: powerReads } = useReadContracts({
    contracts:
      address && snapshotInPast
        ? [
            {
              address: daoConfig.addresses.governor as `0x${string}`,
              abi: governorAbi,
              functionName: 'getVotes' as const,
              args: [address, BigInt(voteStart)] as const,
              chainId: daoConfig.chainId,
            },
            {
              address: daoConfig.addresses.token as `0x${string}`,
              abi: tokenAbi,
              functionName: 'balanceOf' as const,
              args: [address] as const,
              chainId: daoConfig.chainId,
            },
          ]
        : [],
    query: { enabled: !!address && snapshotInPast },
  })

  const votingPower =
    powerReads?.[0]?.status === 'success' ? Number(powerReads[0].result as bigint) : 0
  const tokenBalance =
    powerReads?.[1]?.status === 'success' ? Number(powerReads[1].result as bigint) : 0

  let scenario: VotingPowerScenario = 'none'
  if (pending) scenario = 'pending'
  else if (!isConnected) scenario = 'none'
  else if (votingPower > 0) scenario = 'eligible'
  else if (tokenBalance > 0) scenario = 'delegated'
  else scenario = 'none'

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

  // Clear the choice form on successful mine after a beat.
  useEffect(() => {
    if (!isMined) return
    const t = setTimeout(() => {
      setChoice(null)
      setReason('')
      resetWrite()
    }, 2400)
    return () => clearTimeout(t)
  }, [isMined, resetWrite])

  const submit = () => {
    if (!choice) return
    writeContract({
      address: daoConfig.addresses.governor as `0x${string}`,
      abi: governorAbi,
      functionName: 'castVoteWithReason',
      args: [proposalIdHash, BigInt(SUPPORT[choice]), reason],
    })
  }

  const phase: 'idle' | 'connect' | 'switch' | 'sign' | 'mine' | 'done' | 'error' =
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

  if (pending) {
    return (
      <aside className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface px-6 py-[22px] lg:sticky lg:top-20">
        <h3 className="text-base font-bold">Cast your vote</h3>
        <VotingPowerExplainer
          scenario="pending"
          votingPower={votingPower}
          voteStart={voteStart}
        />
        {address && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-fg">
            <span>Voting as</span>
            <WalletPill address={address} ens={ensName} link={false} size="xs" />
          </div>
        )}
      </aside>
    )
  }

  return (
    <aside className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface px-6 py-[22px] lg:sticky lg:top-20">
      <h3 className="text-base font-bold">Cast your vote</h3>
      <VotingPowerExplainer
        scenario={scenario}
        votingPower={votingPower}
        voteStart={voteStart}
      />

      <div className="grid grid-cols-3 gap-2">
        <ChoiceBtn
          label="For"
          active={choice === 'for'}
          onClick={() => setChoice('for')}
          color="for"
          disabled={!active || phase === 'sign' || phase === 'mine'}
        />
        <ChoiceBtn
          label="Against"
          active={choice === 'against'}
          onClick={() => setChoice('against')}
          color="against"
          disabled={!active || phase === 'sign' || phase === 'mine'}
        />
        <ChoiceBtn
          label="Abstain"
          active={choice === 'abstain'}
          onClick={() => setChoice('abstain')}
          color="abstain"
          disabled={!active || phase === 'sign' || phase === 'mine'}
        />
      </div>

      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason…"
        disabled={!active || phase === 'sign' || phase === 'mine'}
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-accent disabled:opacity-60 sm:text-[13px]"
      />

      {phase === 'connect' ? (
        <Button onClick={() => openConnectModal?.()} className="w-full">
          Connect wallet to vote
        </Button>
      ) : phase === 'switch' ? (
        <Button
          onClick={() => switchChain({ chainId: daoConfig.chainId })}
          className="w-full"
          disabled={isSwitching}
        >
          {isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Switch to {chainNameOf(daoConfig.chainId)}
        </Button>
      ) : (
        <Button
          onClick={submit}
          disabled={
            !active ||
            !choice ||
            votingPower === 0 ||
            phase === 'sign' ||
            phase === 'mine'
          }
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
              Submitting…
            </>
          )}
          {phase === 'done' && 'Vote submitted ✓'}
          {(phase === 'idle' || phase === 'error') && 'Submit vote'}
        </Button>
      )}

      {phase === 'error' && (
        <div className="text-[12.5px] text-destructive">
          {parseWriteError(writeError ?? mineError)}
        </div>
      )}

      {address && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-fg">
          <span>Voting as</span>
          <WalletPill address={address} ens={ensName} link={false} size="xs" />
          {votingPower > 0 && (
            <>
              <span>·</span>
              <strong className="font-semibold">
                {votingPower} {votingPower === 1 ? 'vote' : 'votes'}
              </strong>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function ChoiceBtn({
  label,
  active,
  onClick,
  color,
  disabled,
}: {
  label: string
  active: boolean
  onClick: () => void
  color: 'for' | 'against' | 'abstain'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-11 rounded-md border border-border bg-surface px-2 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-50',
        active && color === 'for' && 'border-vote-for bg-vote-for/15 text-vote-for',
        active &&
          color === 'against' &&
          'border-vote-against bg-vote-against/15 text-vote-against',
        active && color === 'abstain' && 'border-border-strong bg-surface-2 text-fg'
      )}
    >
      {label}
    </button>
  )
}

function chainNameOf(id: number): string {
  return (
    {
      1: 'Ethereum',
      10: 'Optimism',
      8453: 'Base',
      7777777: 'Zora',
    }[id] ?? `Chain ${id}`
  )
}

function parseWriteError(err: unknown): string {
  if (!err) return 'Something went wrong.'
  const msg = err instanceof Error ? err.message : String(err)
  if (/User rejected|user rejected/i.test(msg)) return 'Transaction rejected.'
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas.'
  // Strip viem boilerplate after the first newline.
  return msg.split('\n')[0]
}
