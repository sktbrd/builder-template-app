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

  const pairedIsWeth =
    !!clankerToken &&
    !!wethAddress &&
    isAddressEqual(clankerToken.pairedToken as Address, wethAddress)

  const enabled =
    !!clankerToken &&
    !!publicClient &&
    !!stateViewAddress &&
    !!wethAddress &&
    !!ethUsdPrice &&
    pairedIsWeth

  const { data, error, isLoading } = useSWR(
    enabled
      ? ([
          'clanker-token-usd',
          daoConfig.chainId,
          clankerToken!.tokenAddress,
          ethUsdPrice,
        ] as const)
      : null,
    async ([, , tokenAddress, eth]) => {
      const [sqrtPriceX96] = await publicClient!.readContract({
        address: stateViewAddress!,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [clankerToken!.poolId as `0x${string}`],
      })
      const normalized = getAddress(tokenAddress)
      const paired = getAddress(clankerToken!.pairedToken as string)
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
  if (clankerToken && !pairedIsWeth) {
    return {
      priceUsd: null,
      isLoading: false,
      error: new Error(
        `Clanker token paired with non-WETH currency (${clankerToken.pairedToken}). Inline pricing not yet supported on this template — port the upstream recursive coinPriceService if you need it.`
      ),
    }
  }
  return {
    priceUsd: data ?? null,
    isLoading,
    error: (error as Error | undefined) ?? null,
  }
}
