/**
 * Common ERC-20 tokens per supported chain — opt-in defaults for the
 * treasury-holdings table.
 *
 * Forks add the tokens they care about to `daoConfig.treasuryTokens`. Spread
 * the constants below for convenience, or list addresses by hand.
 *
 *   import { BASE_COMMON_TOKENS } from '@/lib/treasury-tokens'
 *
 *   export const daoConfig = {
 *     ...
 *     treasuryTokens: [
 *       ...BASE_COMMON_TOKENS,
 *       { symbol: 'SENDIT', address: '0xBa5B…', decimals: 18 },
 *     ],
 *   }
 */

export type TreasuryToken = {
  symbol: string
  address: `0x${string}`
  decimals: number
}

export const BASE_COMMON_TOKENS: TreasuryToken[] = [
  {
    symbol: 'USDC',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
  },
  {
    symbol: 'WETH',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
  },
  {
    symbol: 'DAI',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
  },
]

export const ETHEREUM_COMMON_TOKENS: TreasuryToken[] = [
  {
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
  },
  {
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
  },
  {
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    decimals: 18,
  },
]

/** Symbols treated as ~$1 for treasury USD estimates. */
export const STABLE_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'FRAX',
  'LUSD',
  'USDBC',
  'USDS',
  'USDGLO',
  'GUSD',
])

/** Symbols treated as ETH-equivalent for treasury USD estimates. */
export const ETH_EQUIVALENT_SYMBOLS = new Set(['WETH', 'CBETH', 'STETH', 'RETH'])

/** Minimal holding shape the {@link holdingUsdValue} pricing helper needs. */
export type PricedHolding = {
  symbol: string
  decimals: number
  balanceRaw: bigint
  /** Real Alchemy USD value, or `null` when no price was resolved. */
  usdValue: number | null
  /** True when discovered on-chain (unvetted symbol), false for allowlist. */
  discovered: boolean
}

/**
 * Shared USD valuation for a single treasury holding, used by both the
 * `/treasury` page and its OG image so the two totals can never drift.
 *
 * Prefers the real Alchemy `usdValue`. Only when that's absent AND the token
 * comes from the trusted allowlist (`!discovered`) does it fall back to the
 * symbol heuristic (stables ≈ $1, WETH-likes × ETH price). Discovered tokens
 * never get the heuristic: an unvetted coin can spoof a well-known symbol, so
 * without a real price it stays unpriced (and is already dropped by the $5
 * floor upstream). `priced` is false for anything left without a USD figure —
 * callers render an em dash rather than a misleading $0.
 */
export function holdingUsdValue(
  holding: PricedHolding,
  ethUsdPrice: number
): { usd: number; priced: boolean } {
  if (holding.usdValue != null) {
    return { usd: holding.usdValue, priced: true }
  }
  if (holding.discovered) {
    return { usd: 0, priced: false }
  }
  const sym = holding.symbol.toUpperCase()
  const human = Number(holding.balanceRaw) / 10 ** holding.decimals
  if (STABLE_SYMBOLS.has(sym)) return { usd: human, priced: true }
  if (ETH_EQUIVALENT_SYMBOLS.has(sym)) return { usd: human * ethUsdPrice, priced: true }
  return { usd: 0, priced: false }
}
