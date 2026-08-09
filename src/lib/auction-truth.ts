/**
 * Pure helpers for the "optimistic onchain bridge" — the homepage hero reads
 * the auction's CORE state straight from chain (see useAuctionTruth) so it never
 * waits on subgraph indexing lag, and improvises a bid's comment as a tx-keyed
 * local echo (the auction contract has no comment-carrying bid function, so a
 * comment can never round-trip chain or the subgraph for bids placed here).
 *
 * Everything in this file is framework-free and unit-tested in
 * `auction-truth.test.ts`. The React glue lives in the `use*` hooks.
 */
import { shortAddress } from './utils'

/**
 * A bid comment improvised onto a specific bid transaction. Lives only in the
 * actor's session (module-level store, pruned on a TTL) — it is NOT durable and
 * is never seen by other viewers, because the comment never reaches the chain.
 */
export type BidEcho = {
  /** The bid tx hash — the echo's identity. */
  txHash: string
  tokenId: number
  bidder: string
  amountEth: string
  comment: string | null
  /** ms epoch when the echo was recorded (used for TTL pruning + ordering). */
  ts: number
}

/** The bid shape the hero renders (matches AuctionHero's AuctionHeroBid). */
export type MergeableBid = {
  id: string
  amountEth: string
  bidder: string
  bidderShort: string
  comment: string | null
}

// ETH amounts compared numerically — the user-typed amount ("0.5") and the
// subgraph's formatEther amount ("0.500000000000000000") are the same bid.
const AMOUNT_EPSILON = 1e-9

/**
 * Merge tx-keyed bid echoes into the subgraph-sourced bid list.
 *
 * - If an echo matches a server bid (same bidder + ~same amount), backfill the
 *   echo's comment onto it (the subgraph row carries `comment: null` for bids
 *   placed through this template) and DROP the standalone echo — no duplicate.
 * - Echoes with no matching server row yet are prepended (newest-first) so the
 *   actor sees their just-placed bid + comment immediately, before the subgraph
 *   indexes it. They fold into the matched branch once the server row arrives.
 */
export function mergeBidEchoes(
  serverBids: MergeableBid[],
  echoes: BidEcho[]
): MergeableBid[] {
  if (echoes.length === 0) return serverBids
  const bids = serverBids.map((b) => ({ ...b }))
  const represented = new Set<string>()

  for (const echo of echoes) {
    const amt = parseFloat(echo.amountEth)
    const match = bids.find(
      (b) =>
        b.bidder.toLowerCase() === echo.bidder.toLowerCase() &&
        Math.abs(parseFloat(b.amountEth) - amt) < AMOUNT_EPSILON
    )
    if (match) {
      represented.add(echo.txHash)
      // Keep the echo's comment — the subgraph row's comment is structurally
      // null for template bids, so dropping it here would blink the comment out.
      if (!match.comment && echo.comment) match.comment = echo.comment
    }
  }

  const pending = echoes
    .filter((e) => !represented.has(e.txHash))
    .map<MergeableBid>((e) => ({
      id: `echo:${e.txHash}`,
      amountEth: e.amountEth,
      bidder: e.bidder,
      bidderShort: shortAddress(e.bidder),
      comment: e.comment,
    }))

  return [...pending, ...bids]
}

/**
 * Extract the `image` field from an ERC-721 `tokenURI` payload.
 *
 * Builder's metadata renderer returns a `data:application/json;base64,…` (or
 * raw-JSON) data URI; we only need `.image`. Reading this onchain lets the hero
 * learn a freshly-minted token's art URL before the subgraph indexes it — but
 * note the URL is the SAME nouns.build renderer URL the subgraph stores, so this
 * cures INDEXING lag, NOT the renderer's first-paint cold-start (the hero's
 * <img onError> → <AuctionArt> fallback covers that separately).
 *
 * Returns null for https/ipfs metadata URLs (would need a fetch — out of scope;
 * the subgraph + onError fallback cover those) and for any parse failure.
 */
export function parseTokenImage(uri: string | null | undefined): string | null {
  if (!uri) return null
  try {
    const B64 = 'data:application/json;base64,'
    const UTF8 = 'data:application/json,'
    if (uri.startsWith(B64)) {
      const json = JSON.parse(decodeBase64(uri.slice(B64.length)))
      return typeof json?.image === 'string' ? json.image : null
    }
    if (uri.startsWith(UTF8)) {
      const json = JSON.parse(decodeURIComponent(uri.slice(UTF8.length)))
      return typeof json?.image === 'string' ? json.image : null
    }
    if (uri.trim().startsWith('{')) {
      const json = JSON.parse(uri)
      return typeof json?.image === 'string' ? json.image : null
    }
    return null
  } catch {
    return null
  }
}

function decodeBase64(b64: string): string {
  if (typeof atob === 'function') return atob(b64)
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8')
  throw new Error('no base64 decoder available')
}
