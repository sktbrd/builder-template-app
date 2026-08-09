import {
  BUILDER_TREASURY_ADDRESS,
  ZORA_COIN_FACTORY_ADDRESS,
} from '@buildeross/constants'
import {
  createContentPoolConfigWithClankerTokenAsCurrency,
  type DiscoveryPoolConfig,
} from '@buildeross/utils'
import {
  coinFactoryConfig,
  encodeMultiCurvePoolConfig,
} from '@zoralabs/protocol-deployments'
import { type Address, type Hex, zeroAddress, zeroHash } from 'viem'

import { daoConfig } from '@/lib/dao.config'

/**
 * Build the args wagmi `writeContract` needs to call `coinFactory.deploy(...)`.
 * Mirrors apps/web/src/modules/coin/CreateContentCoinForm/CreateContentCoinForm.tsx
 * exactly so the resulting coin lands in the Builder subgraph (filter:
 * platformReferrer == BUILDER_TREASURY_ADDRESS in zoraFactory.ts).
 *
 * The user is `payoutRecipient` (gets all trading rewards). The DAO treasury
 * is a co-owner alongside the user so it can update the coin's metadata after
 * deploy if needed.
 */
export type BuildContentCoinDeployInput = {
  user: Address
  currency: Address // DAO's clanker token address
  clankerTokenPriceUsd: number
  name: string
  symbol: string
  metadataUri: string
}

export type ContentCoinDeployTx = {
  target: Address
  abi: typeof coinFactoryConfig.abi
  functionName: 'deploy'
  args: readonly [
    Address, // payoutRecipient
    readonly Address[], // owners
    string, // uri
    string, // name
    string, // symbol
    Hex, // encoded pool config
    Address, // platformReferrer
    Address, // postDeployHook
    Hex, // postDeployHookData
    Hex, // coinSalt
  ]
}

export function buildContentCoinDeployTx(
  input: BuildContentCoinDeployInput
): ContentCoinDeployTx {
  const { user, currency, clankerTokenPriceUsd, name, symbol, metadataUri } = input

  const poolConfig: DiscoveryPoolConfig =
    createContentPoolConfigWithClankerTokenAsCurrency({
      currency,
      clankerTokenPriceUsd,
    })

  const encoded = encodeMultiCurvePoolConfig({
    currency: poolConfig.currency,
    tickLower: poolConfig.lowerTicks,
    tickUpper: poolConfig.upperTicks,
    numDiscoveryPositions: poolConfig.numDiscoveryPositions,
    maxDiscoverySupplyShare: poolConfig.maxDiscoverySupplyShares,
  }) as Hex

  const treasury = daoConfig.addresses.treasury as Address
  const platformReferrer =
    (BUILDER_TREASURY_ADDRESS[
      daoConfig.chainId as keyof typeof BUILDER_TREASURY_ADDRESS
    ] as Address | undefined) ?? zeroAddress

  return {
    target: ZORA_COIN_FACTORY_ADDRESS as Address,
    abi: coinFactoryConfig.abi,
    functionName: 'deploy',
    args: [
      user, // payoutRecipient
      [user, treasury] as const, // owners: deployer + DAO treasury
      metadataUri,
      name,
      symbol,
      encoded,
      platformReferrer,
      zeroAddress, // postDeployHook
      '0x' as Hex, // postDeployHookData
      zeroHash, // coinSalt
    ],
  }
}
