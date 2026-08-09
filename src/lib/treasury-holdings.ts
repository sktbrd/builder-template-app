/**
 * Treasury token discovery + enrichment (Alchemy-powered).
 *
 * Ported from nouns-builder's `alchemyService.getEnrichedTokenBalances`, adapted
 * to this template's raw-`fetch` style (no `alchemy-sdk` dependency). The flow:
 *
 *   1. `alchemy_getTokenBalances(treasury, 'erc20')` — every ERC-20 the treasury
 *      holds, including tokens received by transfer (which the DAO never created,
 *      so subgraph-only discovery missed them). Zero balances are dropped.
 *   2. `alchemy_getTokenMetadata` per token — name / symbol / decimals / logo.
 *   3. Alchemy Prices REST (`tokens/by-address`, batches of 25) — USD unit price.
 *   4. Enrich: `usdValue = humanBalance × usdPrice`, then keep only rows worth
 *      >= $5 (anti-spam is the *value floor*, not symbol heuristics). Tokens in
 *      the static `daoConfig.treasuryTokens` allowlist are always kept so small
 *      USDC/WETH/DAI reserves never vanish.
 *
 * The enrichment+filter step ({@link enrichTreasuryHoldings}) is a pure function
 * so it can be unit-tested without any network access. The network layer
 * ({@link fetchAlchemyTreasuryHoldings}) returns `null` when no API key is set or
 * the balances call fails, signalling the caller to fall back to its allowlist
 * multicall path.
 */

// Alchemy network slugs per chain (JSON-RPC subdomain + Prices `network` field).
export const ALCHEMY_NETWORK: Record<number, string> = {
  1: 'eth-mainnet',
  10: 'opt-mainnet',
  8453: 'base-mainnet',
  7777777: 'zora-mainnet',
}

/** Value floor, in USD, below which discovered tokens are treated as spam/dust. */
export const MINIMUM_USD_VALUE = 5

/** Enriched treasury holding surfaced on /treasury and in proposal forms. */
export type TreasuryTokenHolding = {
  symbol: string
  address: string
  /** Human-readable token name, when Alchemy metadata provides one. */
  name?: string
  decimals: number
  /** Formatted balance, trimmed (e.g. "1,234.56"). */
  balance: string
  /** Raw on-chain balance (wei-scale). */
  balanceRaw: bigint
  /**
   * USD unit price from Alchemy Prices, or `null` on the allowlist fallback path
   * (multicall has no price oracle) or when Alchemy returns no price.
   */
  usdPrice: number | null
  /** `humanBalance × usdPrice` in USD, or `null` when no price is available. */
  usdValue: number | null
  /**
   * True when the token was discovered from on-chain balances rather than the
   * static `daoConfig.treasuryTokens` allowlist. Allowlisted tokens (false) are
   * trusted for symbol/decimals and are never dropped by the $5 value floor.
   */
  discovered: boolean
}

export type RawTokenBalance = {
  address: string
  balanceRaw: bigint
}

export type TokenMetadataMap = Record<
  string,
  { name?: string; symbol?: string; decimals?: number; logo?: string }
>

/** Address (lowercased) → USD unit price, or `null` when unknown. */
export type TokenPriceMap = Record<string, number | null>

export type AllowlistToken = {
  address: string
  symbol: string
  decimals: number
}

/** Format a raw balance into a trimmed, grouped string (up to 4 decimals). */
export function formatTokenAmount(value: bigint, decimals: number): string {
  if (value === BigInt(0)) return '0'
  const base = BigInt(10) ** BigInt(decimals)
  const whole = value / base
  const fraction = value % base
  if (fraction === BigInt(0)) {
    return whole.toLocaleString('en-US')
  }
  // Show up to 4 fractional digits (trim trailing zeros).
  const fracStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
  const trimmed = fracStr.replace(/0+$/, '')
  return trimmed
    ? `${whole.toLocaleString('en-US')}.${trimmed}`
    : whole.toLocaleString('en-US')
}

/**
 * Pure enrichment + filtering step. Combines balances, metadata and prices into
 * {@link TreasuryTokenHolding}s, drops zero balances, and applies the $5 value
 * floor to discovered tokens (allowlisted tokens are always kept). Sorted by USD
 * value (then raw balance) descending. No network access — safe to unit-test.
 */
export function enrichTreasuryHoldings(
  balances: RawTokenBalance[],
  metadata: TokenMetadataMap,
  prices: TokenPriceMap,
  allowlist: AllowlistToken[]
): TreasuryTokenHolding[] {
  const allowMap = new Map(allowlist.map((t) => [t.address.toLowerCase(), t]))
  const out: TreasuryTokenHolding[] = []

  for (const b of balances) {
    if (b.balanceRaw === BigInt(0)) continue

    const addrLc = b.address.toLowerCase()
    const meta = metadata[addrLc]
    const allow = allowMap.get(addrLc)
    const inAllowlist = !!allow

    // Trust the allowlist's symbol/decimals over unvetted on-chain metadata (a
    // discovered coin could spoof a well-known symbol); fall back to metadata.
    const decimals =
      (inAllowlist ? allow?.decimals : meta?.decimals) ?? meta?.decimals ?? 18
    const symbol = (inAllowlist ? allow?.symbol : meta?.symbol) ?? meta?.symbol ?? '???'
    const name = meta?.name || undefined

    const usdPrice = prices[addrLc] ?? null
    const human = Number(b.balanceRaw) / 10 ** decimals
    const usdValue = usdPrice != null ? human * usdPrice : null

    // Anti-spam: drop discovered tokens worth less than the floor (or unpriced).
    // Allowlisted tokens are always kept regardless of value.
    if (!inAllowlist && (usdValue == null || usdValue < MINIMUM_USD_VALUE)) {
      continue
    }

    out.push({
      symbol,
      address: b.address,
      name,
      decimals,
      balance: formatTokenAmount(b.balanceRaw, decimals),
      balanceRaw: b.balanceRaw,
      usdPrice,
      usdValue,
      discovered: !inAllowlist,
    })
  }

  return out.sort((a, b) => {
    const av = a.usdValue ?? -1
    const bv = b.usdValue ?? -1
    if (bv !== av) return bv - av
    if (b.balanceRaw > a.balanceRaw) return 1
    if (b.balanceRaw < a.balanceRaw) return -1
    return 0
  })
}

// ── Network layer (raw fetch, mirrors api/treasury/transfers/route.ts) ─────────

async function fetchTokenBalances(
  apiKey: string,
  network: string,
  treasury: string
): Promise<RawTokenBalance[]> {
  const res = await fetch(`https://${network}.g.alchemy.com/v2/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [treasury, 'erc20'],
    }),
    next: { revalidate: 300 },
  })

  if (!res.ok) throw new Error(`Alchemy getTokenBalances ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? 'Alchemy error')

  const list: Array<{ contractAddress?: string; tokenBalance?: string | null }> =
    json.result?.tokenBalances ?? []

  const balances: RawTokenBalance[] = []
  for (const t of list) {
    if (!t.contractAddress || !t.tokenBalance) continue
    let raw: bigint
    try {
      raw = BigInt(t.tokenBalance)
    } catch {
      continue
    }
    if (raw === BigInt(0)) continue
    balances.push({ address: t.contractAddress, balanceRaw: raw })
  }
  return balances
}

async function fetchTokenMetadata(
  apiKey: string,
  network: string,
  address: string
): Promise<{ name?: string; symbol?: string; decimals?: number; logo?: string }> {
  try {
    const res = await fetch(`https://${network}.g.alchemy.com/v2/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenMetadata',
        params: [address],
      }),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return {}
    const json = await res.json()
    const m = json.result ?? {}
    return {
      name: m.name ?? undefined,
      symbol: m.symbol ?? undefined,
      decimals: typeof m.decimals === 'number' ? m.decimals : undefined,
      logo: m.logo ?? undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Fetch metadata for many tokens without bursting Alchemy. Mainnet/Base
 * treasuries hold hundreds of airdropped spam ERC-20s, and a naive
 * `Promise.all(addresses.map(...))` fires one JSON-RPC request per token in
 * parallel — 300+ concurrent calls that trip 429s. Instead we run sequential
 * batches (each batch parallel internally), mirroring {@link fetchTokenPrices}.
 * Result order matches the input `addresses` order.
 */
async function fetchTokenMetadataBatched(
  apiKey: string,
  network: string,
  addresses: string[]
): Promise<Array<{ name?: string; symbol?: string; decimals?: number; logo?: string }>> {
  const BATCH_SIZE = 20
  const out: Array<{ name?: string; symbol?: string; decimals?: number; logo?: string }> =
    []
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((a) => fetchTokenMetadata(apiKey, network, a))
    )
    out.push(...results)
  }
  return out
}

async function fetchTokenPrices(
  apiKey: string,
  priceNetwork: string,
  addresses: string[]
): Promise<TokenPriceMap> {
  const prices: TokenPriceMap = {}
  const BATCH_SIZE = 25

  try {
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE)
      const res = await fetch(
        `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addresses: batch.map((address) => ({ network: priceNetwork, address })),
          }),
          next: { revalidate: 300 },
        }
      )
      if (!res.ok) throw new Error(`Alchemy prices ${res.status}`)
      const json = await res.json()
      const data: Array<{
        address?: string
        prices?: Array<{ currency?: string; value?: string }>
      }> = json.data ?? []

      for (const entry of data) {
        if (!entry.address) continue
        const usd = entry.prices?.find((p) => p.currency?.toLowerCase() === 'usd')
        const value = usd?.value != null ? parseFloat(usd.value) : NaN
        prices[entry.address.toLowerCase()] = Number.isFinite(value) ? value : null
      }
    }
  } catch (err) {
    // Prices unavailable — treat all as unknown. Discovered tokens then fall
    // below the $5 floor (dropped) rather than crashing the whole page.
    console.error('[treasury-holdings] prices failed:', err)
    return {}
  }

  return prices
}

// Module-level in-memory cache, keyed by (chainId, treasury). Mirrors Builder's
// 5-minute Redis TTL; the page is already ISR-cached, so this just avoids
// re-fetching within a render burst.
const CACHE_TTL_MS = 5 * 60 * 1000
const holdingsCache = new Map<string, { expires: number; data: TreasuryTokenHolding[] }>()

/**
 * Primary discovery path. Returns enriched holdings, or `null` when there is no
 * API key / unsupported chain / the balances call fails — signalling the caller
 * to fall back to its static allowlist multicall.
 */
export async function fetchAlchemyTreasuryHoldings(
  chainId: number,
  treasury: string,
  allowlist: AllowlistToken[]
): Promise<TreasuryTokenHolding[] | null> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!apiKey) return null

  const network = ALCHEMY_NETWORK[chainId]
  if (!network) return null

  const treasuryLc = treasury.toLowerCase()
  const cacheKey = `${chainId}:${treasuryLc}`
  const cached = holdingsCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  let balances: RawTokenBalance[]
  try {
    balances = await fetchTokenBalances(apiKey, network, treasuryLc)
  } catch (err) {
    console.error('[treasury-holdings] balances failed:', err)
    return null
  }

  if (balances.length === 0) {
    holdingsCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data: [] })
    return []
  }

  const addresses = balances.map((b) => b.address)

  const [metadataList, prices] = await Promise.all([
    fetchTokenMetadataBatched(apiKey, network, addresses),
    fetchTokenPrices(apiKey, network, addresses),
  ])

  const metadata: TokenMetadataMap = {}
  addresses.forEach((a, i) => {
    metadata[a.toLowerCase()] = metadataList[i]
  })

  const holdings = enrichTreasuryHoldings(balances, metadata, prices, allowlist)
  holdingsCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data: holdings })
  return holdings
}
