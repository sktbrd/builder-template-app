'use client'

import { useSyncExternalStore } from 'react'

import type { VoteSupport, VoteTally } from '@/lib/proposal-truth'

/**
 * Per-session record of the vote the actor just cast, keyed by proposalId. The
 * Governor exposes no `getReceipt`/`hasVoted`, so between the tx mining and the
 * subgraph indexing the vote there's no durable signal that it landed — this
 * bridges that window.
 *
 * **Confirmation-gated, by design.** Nothing is recorded on click or submit: the
 * echo is written only once the tx is *mined* (`recordVote`), so the UI never
 * shows a vote that hasn't actually landed on-chain. Once written it:
 *  - flips the "Cast your vote" form to a "You voted X" confirmation,
 *  - overlays the Vote summary bar until the on-chain read catches up,
 *  - injects the vote (with its reason) into the votes list until the subgraph
 *    indexes the real row (then dedup by voter takes over).
 *
 * Survives a client-side remount within the session (navigating away and back).
 * Ephemeral: gone on reload, pruned on a TTL; the durable signal is the subgraph
 * votes list (see findMyVote).
 */
export type VoteEchoStatus = 'confirmed'

export type VoteEcho = {
  proposalId: string
  /** The voter's address — so the votes list can render/dedupe the row. */
  voter: string
  support: VoteSupport
  weight: number
  /** The optional reason/comment the voter attached. */
  reason: string | null
  status: VoteEchoStatus
  /** Tally as displayed when the vote was recorded — base for the summary overlay. */
  base: VoteTally
  /** ms epoch when recorded — used for TTL pruning. */
  ts: number
}

const TTL_MS = 10 * 60 * 1000

const store = new Map<string, VoteEcho>()
const listeners = new Set<() => void>()

function prune(): void {
  const now = Date.now()
  for (const [key, value] of store) {
    if (now - value.ts > TTL_MS) store.delete(key)
  }
}

function emit(): void {
  for (const listener of listeners) listener()
}

/** Record the actor's vote once its tx has mined. Confirmation-gated — there is
 *  no pending/optimistic state, so this is only ever called after on-chain success. */
export function recordVote(echo: Omit<VoteEcho, 'ts' | 'status'>): void {
  prune()
  store.set(echo.proposalId.toLowerCase(), {
    ...echo,
    status: 'confirmed',
    ts: Date.now(),
  })
  emit()
}

/** Drop the actor's echo (e.g. on an explicit reset). */
export function clearVoteEcho(proposalId: string): void {
  if (store.delete(proposalId.toLowerCase())) emit()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/**
 * The actor's echoed vote for `proposalId`, or null. The stored object identity
 * is stable until `recordVote` replaces it, so getSnapshot is safe for
 * useSyncExternalStore (no render loop).
 */
export function useVoteEcho(proposalId: string): VoteEcho | null {
  const key = proposalId.toLowerCase()
  return useSyncExternalStore(
    subscribe,
    () => store.get(key) ?? null,
    () => null
  )
}
