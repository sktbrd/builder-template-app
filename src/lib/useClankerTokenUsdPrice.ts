'use client'

import { UNISWAP_STATE_VIEW_ADDRESS, WETH_ADDRESS } from '@buildeross/constants'
import { useEthUsdPrice } from '@buildeross/hooks'
import { type ClankerTokenFragment } from '@buildeross/sdk/subgraph'
import useSWR from 'swr'
import { type Address, getAddress, isAddressEqual, parseAbi } from 'viem'
import { usePublicClient } from 'wagmi'

import { daoConfig } from '@/lib/dao.config'

/**
 * Minimal client-side port of `apps/web/src/services/coinPriceService.ts`,
 * scoped to the case we actually need: the DAO's clanker token paired with
 * WETH. Reads Uniswap V4 StateView's `getSlot0(poolId)` directly via the
 * connected publicClient, converts `sqrtPriceX96` into a token/WETH ratio,
 * then multiplies by ETH/USD.
 *
 * Returns `null` if the paired token isn't WETH (we don't recurse). For
 * Builder/Gnars/Verdant clanker tokens the paired token *is* WETH, so this
 * covers the realistic forks. The fuller recursive resolver lives upstream
 * in `coinPriceService.ts`; porting it would mean adding Redis + a server
 * route — not worth it for a feature most DAOs will use against WETH.
 */

const STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
])

const SCALE = BigInt(10) ** BigInt(18)
const Q192 = BigInt(2) ** BigInt(192)
const ZERO_BIG = BigInt(0)

function scaledBigIntToNumber(scaled: bigint): number | null {
  const integer = scaled / SCALE
  const fraction = scaled % SCALE
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(integer) + Number(fraction) / 1e18
}

/**
 * Convert Uniswap V4's sqrtPriceX96 into the price of token-of-interest in
 * units of the *paired* token. `isToken0` says whether our token-of-interest
 * sits at index 0 in the pool key.
 */
function priceFromSqrtPriceX96(sqrtPriceX96: bigint, isToken0: boolean): number | null {
  const rawScaled = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192
  if (!isToken0) {
    if (rawScaled === ZERO_BIG) return null
    return scaledBigIntToNumber((SCALE * SCALE) / rawScaled)
  }
  return scaledBigIntToNumber(rawScaled)
}

export type ClankerUsdPriceResult = {
  priceUsd: number | null
  isLoading: boolean
  error: Error | null
}

export function useClankerTokenUsdPrice(
  clankerToken: ClankerTokenFragment | null | undefined
): ClankerUsdPriceResult {
  const publicClient = usePublicClient({ chainId: daoConfig.chainId })
  const { price: ethUsdPrice } = useEthUsdPrice()

  const stateViewAddress = UNISWAP_STATE_VIEW_ADDRESS[
    daoConfig.chainId as keyof typeof UNISWAP_STATE_VIEW_ADDRESS
  ] as Address | undefined
  const wethAddress = WETH_ADDRESS[daoConfig.chainId as keyof typeof WETH_ADDRESS] as
    | Address
    | undefined

  // Snapshot every field we need *before* doing any conditional logic. The
  // earlier version used non-null assertions inside the SWR key/fetcher,
  // which crashed in dev under React strict mode when `clankerToken` was
  // re-checked between the `enabled` ternary and the array literal.
  const tokenAddress = clankerToken?.tokenAddress as Address | undefined
  const poolId = clankerToken?.poolId as `0x${string}` | undefined
  const pairedToken = clankerToken?.pairedToken as Address | undefined

  const pairedIsWeth =
    !!pairedToken && !!wethAddress && isAddressEqual(pairedToken, wethAddress)

  const enabled =
    !!tokenAddress &&
    !!poolId &&
    !!pairedToken &&
    !!publicClient &&
    !!stateViewAddress &&
    !!wethAddress &&
    !!ethUsdPrice &&
    pairedIsWeth

  const { data, error, isLoading } = useSWR(
    enabled ? (['clanker-token-usd', daoConfig.chainId, tokenAddress, ethUsdPrice] as const) : null,
    async ([, , token, eth]) => {
      // Re-check defensively — SWR can occasionally call the fetcher with a
      // stale key after the inputs changed.
      if (!publicClient || !stateViewAddress || !poolId || !pairedToken) return null
      const [sqrtPriceX96] = await publicClient.readContract({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      })
      const normalized = getAddress(token)
      const paired = getAddress(pairedToken)
      const isToken0 = normalized.toLowerCase() < paired.toLowerCase()
      const inPaired = priceFromSqrtPriceX96(sqrtPriceX96, isToken0)
      if (inPaired === null) return null
      return inPaired * (eth as number)
    },
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  if (!clankerToken) {
    return { priceUsd: null, isLoading: false, error: null }
  }
  if (!pairedIsWeth) {
    return {
      priceUsd: null,
      isLoading: false,
      error: new Error(
        `Clanker token paired with non-WETH currency (${pairedToken ?? 'unknown'}). Inline pricing not yet supported on this template — port the upstream recursive coinPriceService if you need it.`
      ),
    }
  }
  return {
    priceUsd: data ?? null,
    isLoading,
    error: (error as Error | undefined) ?? null,
  }
}
