'use client'

import { useSyncExternalStore } from 'react'

import type { BidEcho } from '@/lib/auction-truth'

/**
 * Per-session store of tx-keyed bid comments. The auction contract has no
 * comment-carrying bid function (only createBid / createBidWithReferral), so a
 * comment can never round-trip the chain or the subgraph for bids placed here.
 * This is the improvisation: when the actor's bid mines, we stash their comment
 * keyed by the bid tx hash and merge it into the hero's "Recent bids" so they
 * see THEIR bid + comment immediately. It is intentionally ephemeral — gone on
 * reload, never visible to other viewers — and pruned on a TTL.
 */

const TTL_MS = 10 * 60 * 1000

const store = new Map<string, BidEcho>()
const listeners = new Set<() => void>()
const EMPTY: BidEcho[] = []
let snapshot: BidEcho[] = EMPTY

function recompute() {
  const now = Date.now()
  for (const [key, value] of store) {
    if (now - value.ts > TTL_MS) store.delete(key)
  }
  // Newest-first so the just-placed bid leads the merged list.
  snapshot = Array.from(store.values()).sort((a, b) => b.ts - a.ts)
}

function emit() {
  for (const listener of listeners) listener()
}

/** Record (or replace) the comment for a bid tx. Keyed by tx hash. */
export function addBidEcho(echo: Omit<BidEcho, 'ts'>): void {
  store.set(echo.txHash, { ...echo, ts: Date.now() })
  recompute()
  emit()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): BidEcho[] {
  return snapshot
}

function getServerSnapshot(): BidEcho[] {
  return EMPTY
}

/** Reactive list of echoes, optionally filtered to a single token. */
export function useBidEchoes(tokenId?: number): BidEcho[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (tokenId == null) return all
  return all.filter((e) => e.tokenId === tokenId)
}
