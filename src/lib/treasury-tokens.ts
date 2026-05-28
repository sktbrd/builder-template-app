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
export const STABLE_SYMBOLS = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD'] as const

/** Symbols treated as ETH-equivalent for treasury USD estimates. */
export const ETH_EQUIVALENT_SYMBOLS = ['WETH', 'CBETH', 'STETH', 'RETH'] as const
