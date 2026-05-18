import {
  createClankerPoolPositionsFromTargetFdv,
  DEFAULT_CLANKER_TARGET_FDV,
  DEFAULT_CLANKER_TICK_SPACING,
  FEE_CONFIGS,
} from '@buildeross/utils'
import { type ClankerTokenV4, FEE_CONFIGS as SDK_FEE_CONFIGS } from 'clanker-sdk'
import { Clanker } from 'clanker-sdk/v4'
import { type Address, encodeFunctionData, type Hex, type PublicClient } from 'viem'

import { daoConfig } from '@/lib/dao.config'

/**
 * Inputs the modal collects from the user. Everything else (vault, fees, FDV,
 * paired token) is defaulted to match what `apps/web`'s `CreatorCoin.tsx`
 * proposes for treasury-admin'd creator coins.
 */
export type CreatorCoinProposalInput = {
  /** DAO treasury — becomes `tokenAdmin` and the sole rewards recipient. */
  treasury: Address
  /** Paired/backing currency. WETH for now; eventually the DAO's own
   * clanker token once a fork has multiple in flight. */
  pairedToken: Address
  /** USD price of the paired token. ETH/USD for WETH. */
  quoteTokenUsd: number
  /** Coin identity, collected from the user. */
  name: string
  symbol: string
  description: string
  image: string
  /** Optional initial purchase by the treasury on deploy. */
  devBuyEth?: number
}

export type CreatorCoinProposalTx = {
  target: Address
  value: bigint
  calldata: Hex
  expectedAddress: Address | undefined
  /** Pre-rendered title + description we suggest to the proposer. The
   * proposal-create form lets the user edit these before submitting. */
  suggestedTitle: string
  suggestedDescription: string
}

/**
 * Build the on-chain transaction the proposal should execute: a Clanker V4
 * factory deploy where `tokenAdmin = DAO treasury` and rewards recipient =
 * DAO treasury. Once the proposal passes and executes, the indexer
 * (`apps/subgraph/src/clanker.ts → loadDAOFromTreasury(tokenAdmin)`) will
 * associate the new clanker token with this DAO, unblocking `/coins/new`.
 */
export async function buildCreatorCoinProposalTx(
  input: CreatorCoinProposalInput,
  opts?: { publicClient?: PublicClient }
): Promise<CreatorCoinProposalTx> {
  const positions = createClankerPoolPositionsFromTargetFdv({
    targetFdvUsd: DEFAULT_CLANKER_TARGET_FDV,
    quoteTokenUsd: input.quoteTokenUsd,
  })

  const tokenConfig = {
    name: input.name,
    chainId: daoConfig.chainId as ClankerTokenV4['chainId'],
    symbol: input.symbol,
    tokenAdmin: input.treasury,
    image: input.image,
    metadata: { description: input.description },
    context: { interface: `${daoConfig.name} creator coin proposal` },
    pool: {
      tickIfToken0IsClanker: positions.length > 0 ? positions[0].tickLower : 0,
      pairedToken: input.pairedToken,
      tickSpacing: DEFAULT_CLANKER_TICK_SPACING,
      positions,
    },
    fees: SDK_FEE_CONFIGS[FEE_CONFIGS.StaticBasic],
    rewards: {
      recipients: [
        {
          recipient: input.treasury,
          admin: input.treasury,
          bps: 10000,
          token: 'Paired' as const,
        },
      ],
    },
    ...(input.devBuyEth && input.devBuyEth > 0
      ? {
          devBuy: {
            ethAmount: input.devBuyEth,
            recipient: input.treasury,
          },
        }
      : {}),
  } as ClankerTokenV4

  const clanker = new Clanker(
    opts?.publicClient ? { publicClient: opts.publicClient } : undefined
  )
  const tx = await clanker.getDeployTransaction(tokenConfig)

  const calldata = encodeFunctionData({
    abi: tx.abi as any,
    functionName: tx.functionName as string,

    args: tx.args as any,
  })

  const preview = buildCreatorCoinProposalPreview({
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    treasury: input.treasury,
    devBuyEth: input.devBuyEth,
    expectedAddress: tx.expectedAddress as Address | undefined,
  })

  return {
    target: tx.address as Address,
    value: (tx.value ?? BigInt(0)) as bigint,
    calldata,
    expectedAddress: tx.expectedAddress as Address | undefined,
    suggestedTitle: preview.title,
    suggestedDescription: preview.description,
  }
}

/**
 * Builds the proposal title + description from whatever subset of fields the
 * user has filled. Used in two places:
 * - The modal's live preview (no `expectedAddress` yet — we don't run the
 *   SDK until submit). The user can edit the result before submitting.
 * - `buildCreatorCoinProposalTx` post-SDK, which appends the predicted
 *   address section.
 *
 * Empty fields are simply skipped (no `(none)` placeholders, no empty
 * sections). The result is always valid markdown.
 */
export type CreatorCoinPreviewArgs = {
  name?: string
  symbol?: string
  description?: string
  treasury?: Address
  devBuyEth?: number
  expectedAddress?: Address
}

export function buildCreatorCoinProposalPreview(args: CreatorCoinPreviewArgs): {
  title: string
  description: string
} {
  const name = args.name?.trim() ?? ''
  const symbol = args.symbol?.trim() ?? ''
  const description = args.description?.trim() ?? ''

  const title =
    name || symbol ? `Deploy ${name || 'NAME'} (${symbol || 'SYM'}) creator coin` : ''

  const lines: string[] = []
  if (name || symbol) {
    lines.push(`## Deploy ${name || 'NAME'} ($${symbol || 'SYM'}) creator coin`)
    lines.push('')
  }
  if (description) {
    lines.push(description)
    lines.push('')
  }

  // The "Why" section only depends on the DAO name, so we always include it
  // once any coin field has been filled — gives the proposer some structure
  // to start from rather than a blank box.
  if (name || symbol || description) {
    lines.push('## Why')
    lines.push(
      `This proposal deploys ${daoConfig.name}'s creator coin via [Clanker](https://clanker.world). Once live, anyone can deploy Zora content coins paired with this token — every trade routes through it, so the DAO captures pool fees + paired-token demand.`
    )
    lines.push('')
  }

  // Mechanics are static defaults plus a treasury address — render only when
  // we have at least the treasury so the user doesn't see `${undefined}`.
  if (args.treasury && (name || symbol || description)) {
    lines.push('## Mechanics')
    lines.push(`- **Token admin:** \`${args.treasury}\` (DAO treasury)`)
    lines.push(`- **Rewards recipient:** DAO treasury (100% of paired-token fees)`)
    lines.push(`- **Paired token:** WETH on ${chainName(daoConfig.chainId)}`)
    lines.push('- **Fee config:** StaticBasic (1% on every swap)')
    lines.push(`- **Target FDV:** ~$${DEFAULT_CLANKER_TARGET_FDV.toLocaleString()}`)
    if (args.devBuyEth && args.devBuyEth > 0) {
      lines.push(`- **Initial purchase:** ${args.devBuyEth} ETH from treasury`)
    }
  }

  if (args.expectedAddress) {
    lines.push('')
    lines.push(`## Predicted address`)
    lines.push(`\`${args.expectedAddress}\``)
    lines.push('')
    lines.push(
      `After execution, the coin will be viewable at https://clanker.world/clanker/${args.expectedAddress}`
    )
  }

  return { title, description: lines.join('\n').trim() }
}

function chainName(id: number): string {
  return (
    {
      1: 'Ethereum',
      10: 'Optimism',
      8453: 'Base',
      84532: 'Base Sepolia',
      7777777: 'Zora',
    }[id] ?? `chain ${id}`
  )
}
