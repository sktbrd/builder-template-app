'use client'

import { useSyncExternalStore } from 'react'

import type { VoteSupport, VoteTally } from '@/lib/proposal-truth'

/**
 * Per-session record of the vote the actor just cast, keyed by proposalId. The
 * Governor exposes no `getReceipt`/`hasVoted`, so until the subgraph indexes the
 * vote there's no way to tell the actor it landed — this bridges that window.
 *
 * Two roles, distinguished by `status`:
 *  - `pending` (recorded on submit): drives the optimistic Vote summary overlay
 *    (the bar bumps by the actor's weight the instant they submit). The form
 *    stays in its submitting state — a pending echo does NOT flip it to "You
 *    voted", since the tx could still be rejected or revert.
 *  - `confirmed` (set on mine): flips the "Cast your vote" form to a "You voted
 *    X" confirmation; the optimistic overlay reconciles away once the on-chain
 *    read catches up.
 * Cleared (clearVoteEcho) on tx error so the optimistic bump rolls back.
 *
 * Survives a client-side remount within the session (navigating away and back).
 * Ephemeral: gone on reload, pruned on a TTL; the durable signal is the subgraph
 * votes list (see findMyVote).
 */
export type VoteEchoStatus = 'pending' | 'confirmed'

export type VoteEcho = {
  proposalId: string
  support: VoteSupport
  weight: number
  status: VoteEchoStatus
  /** Tally as displayed when the vote was submitted — base for the optimistic overlay. */
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

/** Record the actor's just-submitted vote as `pending` (optimistic overlay on). */
export function addVoteEcho(echo: Omit<VoteEcho, 'ts' | 'status'>): void {
  prune()
  store.set(echo.proposalId.toLowerCase(), { ...echo, status: 'pending', ts: Date.now() })
  emit()
}

/** Promote the actor's pending vote to `confirmed` once its tx mines. No-op if absent. */
export function confirmVoteEcho(proposalId: string): void {
  const key = proposalId.toLowerCase()
  const existing = store.get(key)
  if (!existing) return
  store.set(key, { ...existing, status: 'confirmed' })
  emit()
}

/** Drop the actor's echo (e.g. tx rejected/reverted) so the optimistic bump rolls back. */
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
 * is stable until `addVoteEcho` replaces it, so getSnapshot is safe for
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
