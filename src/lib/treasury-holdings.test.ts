/**
 * Unit tests for the Alchemy-powered treasury discovery.
 *
 * The enrichment + filter step is a pure function ({@link enrichTreasuryHoldings})
 * so the interesting logic — value math, the $5 spam floor, allowlist keep-alive,
 * zero-balance drop — is testable without any network. One test also covers the
 * network entry point's "no API key → fall back" contract.
 *
 * Run with `pnpm test`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type AllowlistToken,
  enrichTreasuryHoldings,
  fetchAlchemyTreasuryHoldings,
  MINIMUM_USD_VALUE,
  type RawTokenBalance,
  type TokenMetadataMap,
  type TokenPriceMap,
} from './treasury-holdings'

const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const SPAM = '0x1111111111111111111111111111111111111111'
const BIG = '0x2222222222222222222222222222222222222222'

const allowlist: AllowlistToken[] = [{ symbol: 'USDC', address: USDC, decimals: 6 }]

describe('enrichTreasuryHoldings', () => {
  it('computes usdValue from balance × price', () => {
    const balances: RawTokenBalance[] = [
      // 1000 tokens at 18 decimals
      { address: BIG, balanceRaw: BigInt(1000) * BigInt(10) ** BigInt(18) },
    ]
    const metadata: TokenMetadataMap = {
      [BIG]: { symbol: 'BIG', name: 'Big Coin', decimals: 18 },
    }
    const prices: TokenPriceMap = { [BIG]: 2.5 }

    const [h] = enrichTreasuryHoldings(balances, metadata, prices, [])
    expect(h.usdPrice).toBe(2.5)
    expect(h.usdValue).toBeCloseTo(2500)
    expect(h.discovered).toBe(true)
    expect(h.balanceRaw).toBe(BigInt(1000) * BigInt(10) ** BigInt(18))
  })

  it('drops a $2 spam token but keeps a $6 one (the $5 floor)', () => {
    const balances: RawTokenBalance[] = [
      { address: SPAM, balanceRaw: BigInt(2) * BigInt(10) ** BigInt(18) }, // $2
      { address: BIG, balanceRaw: BigInt(6) * BigInt(10) ** BigInt(18) }, // $6
    ]
    const metadata: TokenMetadataMap = {
      [SPAM]: { symbol: 'SPAM', decimals: 18 },
      [BIG]: { symbol: 'BIG', decimals: 18 },
    }
    const prices: TokenPriceMap = { [SPAM]: 1, [BIG]: 1 }

    const result = enrichTreasuryHoldings(balances, metadata, prices, [])
    expect(result.map((h) => h.symbol)).toEqual(['BIG'])
    expect(MINIMUM_USD_VALUE).toBe(5)
  })

  it('keeps allowlist tokens even when their USD value is below the floor', () => {
    const balances: RawTokenBalance[] = [
      // 1 USDC = $1, well under the $5 floor, but allowlisted → kept.
      { address: USDC, balanceRaw: BigInt(1_000_000) },
    ]
    const metadata: TokenMetadataMap = { [USDC]: { symbol: 'USDC', decimals: 6 } }
    const prices: TokenPriceMap = { [USDC]: 1 }

    const [h] = enrichTreasuryHoldings(balances, metadata, prices, allowlist)
    expect(h.symbol).toBe('USDC')
    expect(h.discovered).toBe(false)
    expect(h.usdValue).toBeCloseTo(1)
  })

  it('keeps an allowlist token with no price (usdValue null)', () => {
    const balances: RawTokenBalance[] = [{ address: USDC, balanceRaw: BigInt(5_000_000) }]
    const metadata: TokenMetadataMap = { [USDC]: { symbol: 'USDC', decimals: 6 } }
    const prices: TokenPriceMap = {} // no price returned

    const [h] = enrichTreasuryHoldings(balances, metadata, prices, allowlist)
    expect(h.symbol).toBe('USDC')
    expect(h.usdPrice).toBeNull()
    expect(h.usdValue).toBeNull()
  })

  it('drops zero-balance tokens', () => {
    const balances: RawTokenBalance[] = [
      { address: USDC, balanceRaw: BigInt(0) },
      { address: BIG, balanceRaw: BigInt(10) * BigInt(10) ** BigInt(18) },
    ]
    const metadata: TokenMetadataMap = { [BIG]: { symbol: 'BIG', decimals: 18 } }
    const prices: TokenPriceMap = { [BIG]: 1 }

    const result = enrichTreasuryHoldings(balances, metadata, prices, allowlist)
    expect(result.map((h) => h.address)).toEqual([BIG])
  })
})

describe('fetchAlchemyTreasuryHoldings', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns null (fall back) when no API key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ALCHEMY_API_KEY', '')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await fetchAlchemyTreasuryHoldings(8453, USDC, allowlist)
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
