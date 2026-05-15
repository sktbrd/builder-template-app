import {
  createClankerPoolPositionsFromTargetFdv,
  DEFAULT_CLANKER_TARGET_FDV,
  DEFAULT_CLANKER_TICK_SPACING,
  FEE_CONFIGS,
} from '@buildeross/utils'
import { type ClankerTokenV4, FEE_CONFIGS as SDK_FEE_CONFIGS } from 'clanker-sdk'
import { Clanker } from 'clanker-sdk/v4'
import type { Address, PublicClient } from 'viem'

import { daoConfig } from '@/lib/dao.config'

/**
 * Inputs to build a ClankerTokenV4 deploy config for a Gnars-style direct
 * deploy. `currency` is the paired token (WETH or the DAO's own clanker token).
 * `quoteTokenUsd` is the USD price of the paired token; used to set the FDV
 * anchor for the pool positions.
 */
export type BuildClankerTokenInput = {
  chainId: number
  deployer: Address
  currency: Address
  quoteTokenUsd: number
  name: string
  symbol: string
  description: string
  image: string
}

/**
 * The deployer is admin and sole rewards recipient. The DAO is only the
 * paired currency — no governance role over the resulting coin. Mirrors
 * upstream CreatorCoin.tsx for everything except admin/recipient (which
 * upstream pins to the DAO treasury).
 */
export function buildClankerTokenConfig(input: BuildClankerTokenInput): ClankerTokenV4 {
  const { chainId, deployer, currency, quoteTokenUsd, name, symbol, description, image } =
    input

  const positions = createClankerPoolPositionsFromTargetFdv({
    targetFdvUsd: DEFAULT_CLANKER_TARGET_FDV,
    quoteTokenUsd,
  })
  const tickIfToken0IsClanker = positions.length > 0 ? positions[0].tickLower : 0

  return {
    name,
    chainId: chainId as ClankerTokenV4['chainId'],
    symbol,
    tokenAdmin: deployer,
    image,
    metadata: { description },
    context: { interface: `${daoConfig.name} coin launcher` },
    pool: {
      tickIfToken0IsClanker,
      pairedToken: currency,
      tickSpacing: DEFAULT_CLANKER_TICK_SPACING,
      positions,
    },
    fees: SDK_FEE_CONFIGS[FEE_CONFIGS.StaticBasic],
    rewards: {
      recipients: [
        { recipient: deployer, admin: deployer, bps: 10000, token: 'Paired' as const },
      ],
    },
  } as ClankerTokenV4
}

export type PreparedDeployTx = {
  target: Address
  abi: readonly unknown[]
  functionName: string
  args: readonly unknown[]
  value: bigint
  expectedAddress: Address
}

/**
 * Thin wrapper over `clanker.getDeployTransaction` so the form just needs the
 * user-facing inputs. Returns the shape wagmi's `writeContract` expects.
 *
 * `publicClient` is optional — Clanker uses it for CREATE2 prediction when set,
 * but `expectedAddress` is also returned by the SDK in v4.2+.
 */
export async function prepareClankerDeployTx(
  input: BuildClankerTokenInput,
  opts?: { publicClient?: PublicClient }
): Promise<PreparedDeployTx> {
  const config = buildClankerTokenConfig(input)
  const clanker = new Clanker(
    opts?.publicClient ? { publicClient: opts.publicClient } : undefined
  )
  const tx = await clanker.getDeployTransaction(config)
  return {
    target: tx.address as Address,
    abi: tx.abi as readonly unknown[],
    functionName: tx.functionName as string,
    args: tx.args as readonly unknown[],
    value: (tx.value ?? BigInt(0)) as bigint,
    expectedAddress: tx.expectedAddress as Address,
  }
}
