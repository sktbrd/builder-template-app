/**
 * Pure tab model for the proposal detail page. Kept out of the React tree so
 * the "which tabs exist" and "what does ?tab= resolve to" rules are unit
 * testable under the repo's node-environment vitest setup.
 */

export const PROPOSAL_TAB_KEYS = [
  'proposal',
  'transactions',
  'votes',
  'propdates',
] as const

export type ProposalTabKey = (typeof PROPOSAL_TAB_KEYS)[number]

export const PROPOSAL_TAB_LABELS: Record<ProposalTabKey, string> = {
  proposal: 'Proposal',
  transactions: 'Transactions',
  votes: 'Votes',
  propdates: 'Propdates',
}

/**
 * Tabs to render, in reading order. Propdates are attestation-backed, so the
 * tab only exists on chains where EAS is deployed.
 */
export function availableProposalTabs({
  propdatesSupported,
}: {
  propdatesSupported: boolean
}): ProposalTabKey[] {
  return PROPOSAL_TAB_KEYS.filter((key) => key !== 'propdates' || propdatesSupported)
}

/**
 * Resolve a `?tab=` value to a tab that is actually rendered. Unknown values,
 * and tabs hidden on this chain, fall back to the first available tab so a
 * stale or hand-edited link still lands somewhere useful.
 */
export function parseProposalTab(
  raw: string | null | undefined,
  available: readonly ProposalTabKey[]
): ProposalTabKey {
  const fallback = available[0] ?? PROPOSAL_TAB_KEYS[0]
  if (!raw) return fallback
  const normalised = raw.trim().toLowerCase()
  const match = available.find((key) => key === normalised)
  return match ?? fallback
}
