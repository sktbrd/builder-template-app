'use client'

import { useSyncExternalStore } from 'react'

import type { VoteSupport } from '@/lib/proposal-truth'

/**
 * Per-session record of the vote the actor just cast, keyed by proposalId. The
 * Governor exposes no `getReceipt`/`hasVoted`, so until the subgraph indexes the
 * vote there's no way to tell the actor it landed — this bridges that window so
 * the "Cast your vote" form flips to a "You voted X" confirmation the instant
 * their tx mines, and survives a client-side remount within the session
 * (navigating away and back). Ephemeral: gone on reload, pruned on a TTL; the
 * durable signal is the subgraph votes list (see findMyVote).
 */
export type VoteEcho = {
  proposalId: string
  support: VoteSupport
  weight: number
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

/** Record (or replace) the actor's vote for a proposal. */
export function addVoteEcho(echo: Omit<VoteEcho, 'ts'>): void {
  prune()
  store.set(echo.proposalId.toLowerCase(), { ...echo, ts: Date.now() })
  emit()
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
