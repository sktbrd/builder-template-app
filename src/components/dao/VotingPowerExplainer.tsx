import { ArrowUpRight, Check, Hourglass, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

export type VotingPowerScenario =
  | 'none'
  | 'delegated'
  | 'incoming'
  | 'eligible'
  | 'pending'

type Props = {
  scenario: VotingPowerScenario
  /** Number of votes the connected wallet has at the snapshot. */
  votingPower?: number
  /** Unix seconds — used by the `pending` scenario to show "opens in X". */
  voteStart?: number
  className?: string
}

export function VotingPowerExplainer({
  scenario,
  votingPower = 0,
  voteStart,
  className,
}: Props) {
  const c = render(scenario, votingPower, voteStart)
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border border-accent/25 bg-accent/5 px-4 py-3.5',
        className
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
        {c.icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{c.title}</div>
        <div className="mt-0.5 text-[13px] text-muted-fg">{c.body}</div>
      </div>
    </div>
  )
}

function render(scenario: VotingPowerScenario, votingPower: number, voteStart?: number) {
  switch (scenario) {
    case 'pending':
      return {
        icon: <Hourglass className="h-4 w-4" />,
        title: 'Voting opens soon',
        body: voteStart
          ? `Voting opens ${formatOpensIn(voteStart)}. Your voting power is locked in at that moment.`
          : 'Voting hasn’t opened yet. Your voting power is locked in when it does.',
      }
    case 'none':
      return {
        icon: <Info className="h-4 w-4" />,
        title: "You can't vote on this proposal",
        body: 'You held 0 tokens at the snapshot block.',
      }
    case 'delegated':
      return {
        icon: <ArrowUpRight className="h-4 w-4" />,
        title: 'Your votes are delegated',
        body: 'You hold tokens but have delegated voting power away. The delegate votes on your behalf.',
      }
    case 'incoming':
      return {
        icon: <Hourglass className="h-4 w-4" />,
        title: 'Incoming delegation',
        body: 'An incoming delegation will become active soon.',
      }
    case 'eligible':
    default:
      return {
        icon: <Check className="h-4 w-4" />,
        title: 'You can vote',
        body:
          votingPower > 0
            ? `You hold ${votingPower} ${votingPower === 1 ? 'vote' : 'votes'}, eligible to vote on this proposal.`
            : 'Eligible to vote on this proposal.',
      }
  }
}

function formatOpensIn(voteStart: number): string {
  const diff = voteStart - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'now'
  if (diff < 60) return `in ${diff}s`
  const m = Math.floor(diff / 60)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `in ${d}d ${h % 24}h`
}
