'use client'

import { useState } from 'react'

import { VotingPowerExplainer } from '@/components/dao/VotingPowerExplainer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Choice = 'for' | 'against' | 'abstain'

type Props = {
  votingPower?: number
  initialChoice?: Choice | null
  /** Whether voting is open (proposal is in active state). */
  active?: boolean
}

export function VotePanel({
  votingPower = 4,
  initialChoice = null,
  active = true,
}: Props) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice)
  const [reason, setReason] = useState('')

  return (
    <aside className="sticky top-20 flex flex-col gap-3.5 rounded-xl border border-border bg-surface px-6 py-[22px]">
      <h3 className="text-base font-bold">Cast your vote</h3>
      <VotingPowerExplainer scenario={votingPower > 0 ? 'eligible' : 'none'} />

      <div className="grid grid-cols-3 gap-2">
        <ChoiceBtn
          label="For"
          active={choice === 'for'}
          onClick={() => setChoice('for')}
          color="for"
          disabled={!active}
        />
        <ChoiceBtn
          label="Against"
          active={choice === 'against'}
          onClick={() => setChoice('against')}
          color="against"
          disabled={!active}
        />
        <ChoiceBtn
          label="Abstain"
          active={choice === 'abstain'}
          onClick={() => setChoice('abstain')}
          color="abstain"
          disabled={!active}
        />
      </div>

      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason…"
        disabled={!active}
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-accent disabled:opacity-60"
      />

      <Button disabled={!active || !choice} className="w-full">
        Submit vote
      </Button>

      <div className="text-[12.5px] text-muted-fg">
        You have <strong className="font-semibold">{votingPower} votes</strong>.
      </div>
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
        'rounded-md border border-border bg-surface px-2 py-2.5 text-[13px] font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-50',
        active &&
          color === 'for' &&
          'border-vote-for bg-vote-for/15 text-vote-for',
        active &&
          color === 'against' &&
          'border-vote-against bg-vote-against/15 text-vote-against',
        active &&
          color === 'abstain' &&
          'border-border-strong bg-surface-2 text-fg'
      )}
    >
      {label}
    </button>
  )
}
