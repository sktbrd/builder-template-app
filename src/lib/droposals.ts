/**
 * Droposals data layer — the read/display side of governance proposals that
 * deploy a Zora NFT edition (createEdition). Detection is delegated to the
 * shared `decodeProposalTx` decoder (which checks the per-chain Zora NFT
 * Creator target + the createEdition selector) so the Zora address never gets
 * hardcoded here.
 *
 * `getDroposals` is import-safe for client components (it calls the SDK's
 * `getProposals` + the pure decoder). `getDroposalByNumber` additionally reads
 * an execution receipt via a public client — that client is built lazily inside
 * the function so importing this module on the client doesn't touch any
 * server-only API. Only call `getDroposalByNumber` from a server component.
 */
import { PUBLIC_DEFAULT_CHAINS } from '@buildeross/constants/chains'
import { getProposals, SubgraphSDK } from '@buildeross/sdk/subgraph'
import { transports } from '@buildeross/utils/wagmi'
import { createPublicClient } from 'viem'

import { daoConfig } from '@/lib/dao.config'
import { decodeProposalTx } from '@/lib/proposal-tx-decoder'
import { resolveIpfs } from '@/lib/utils'

/** Zora's open-edition sentinel (max uint64). `0` is also treated as open. */
const OPEN_EDITION_SENTINEL = '18446744073709551615'

export type DroposalStatus =
  | 'executed'
  | 'queued'
  | 'active'
  | 'pending'
  | 'defeated'
  | 'canceled'
  | 'vetoed'
  | 'expired'

export type DroposalListItem = {
  proposalNumber: number
  proposalId: string
  title: string
  name: string
  symbol: string
  description?: string
  image?: string
  animationUrl?: string
  priceEth: string
  editionSize: string
  isOpenEdition: boolean
  fundsRecipient: string
  defaultAdmin: string
  createdAtMs: number
  executedAtMs?: number
  status: DroposalStatus
  executionTransactionHash?: string
}

export type DroposalDetailData = DroposalListItem & {
  royaltyBps: number
  saleStartMs: number
  saleEndMs: number
  dropAddress: `0x${string}` | null
}

/**
 * Minimal subgraph proposal shape we read off the fragment. `getProposals`
 * already splits `targets` / `calldatas` / `values` into arrays.
 */
type ProposalFragmentLike = {
  proposalNumber: number
  proposalId: unknown
  title?: string | null
  description?: string | null
  targets?: readonly unknown[] | null
  calldatas?: string | readonly unknown[] | null
  values?: readonly unknown[] | null
  timeCreated?: unknown
  executedAt?: unknown
  executionTransactionHash?: unknown
  vetoTransactionHash?: unknown
  cancelTransactionHash?: unknown
  voteStart?: unknown
  voteEnd?: unknown
  expiresAt?: unknown
}

function isOpenEdition(editionSize: string): boolean {
  return editionSize === '0' || editionSize === OPEN_EDITION_SENTINEL
}

/**
 * Builder stores `calldatas` as a single colon-joined string. `getProposals`
 * pre-splits it to an array, but a direct `SubgraphSDK.proposals` query returns
 * the raw string — normalize either shape to an array so decoding works in
 * both paths.
 */
function toCalldataArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((c) => String(c))
  if (typeof v === 'string') return v.length ? v.split(':') : []
  return []
}

/**
 * Derive a coarse status from the fragment's lifecycle fields. Simpler than the
 * full Governor state machine (we don't read tallies/quorum here) — correctness
 * over completeness, matching the spec.
 */
function deriveStatus(p: ProposalFragmentLike): DroposalStatus {
  if (p.executedAt) return 'executed'
  if (p.vetoTransactionHash) return 'vetoed'
  if (p.cancelTransactionHash) return 'canceled'

  const now = Math.floor(Date.now() / 1000)
  const expires = p.expiresAt ? Number(p.expiresAt) : null
  if (expires && now > expires) return 'expired'

  const voteStart = p.voteStart ? Number(p.voteStart) : 0
  const voteEnd = p.voteEnd ? Number(p.voteEnd) : 0

  // Voting hasn't opened yet.
  if (voteStart > 0 && now < voteStart) return 'pending'
  // Voting is in progress.
  if (voteEnd > 0 && now < voteEnd) return 'active'
  // Voting closed; expiresAt set implies the governor queued it.
  if (expires) return 'queued'
  return 'defeated'
}

/** Find the first createEdition tx in a proposal and map it to a list item. */
function mapDroposal(p: ProposalFragmentLike): DroposalListItem | null {
  const targets = (p.targets ?? []) as unknown[]
  const calldatas = toCalldataArray(p.calldatas)
  const values = (p.values ?? []) as unknown[]

  for (let i = 0; i < targets.length; i++) {
    const decoded = decodeProposalTx(
      {
        target: String(targets[i]),
        calldata: calldatas[i] != null ? String(calldatas[i]) : '0x',
        valueWei: BigInt(values[i] != null ? String(values[i]) : '0'),
      },
      daoConfig.chainId
    )
    if (decoded.type !== 'droposal') continue

    const image = decoded.imageURI ? resolveIpfs(decoded.imageURI) : undefined
    const animationUrl = decoded.animationURI
      ? resolveIpfs(decoded.animationURI)
      : undefined

    return {
      proposalNumber: Number(p.proposalNumber),
      proposalId: String(p.proposalId),
      title: p.title ?? `Proposal #${p.proposalNumber}`,
      name: decoded.name,
      symbol: decoded.symbol,
      description: decoded.collectionDescription || undefined,
      image,
      animationUrl,
      priceEth: decoded.pricePerMintEth,
      editionSize: decoded.editionSize,
      isOpenEdition: isOpenEdition(decoded.editionSize),
      fundsRecipient: decoded.fundsRecipient,
      defaultAdmin: decoded.defaultAdmin,
      createdAtMs: p.timeCreated ? Number(p.timeCreated) * 1000 : 0,
      executedAtMs: p.executedAt ? Number(p.executedAt) * 1000 : undefined,
      status: deriveStatus(p),
      executionTransactionHash: p.executionTransactionHash
        ? String(p.executionTransactionHash)
        : undefined,
    }
  }
  return null
}

/**
 * List droposals for the active DAO, newest-first.
 *
 * NOTE: only fetches a single page of `max` proposals. Deep pagination (walking
 * subsequent pages to surface older droposals) is a follow-up.
 */
export async function getDroposals(max = 100): Promise<DroposalListItem[]> {
  const { proposals } = await getProposals(
    daoConfig.chainId,
    daoConfig.addresses.token,
    max,
    1
  )

  const items: DroposalListItem[] = []
  for (const p of proposals as unknown as ProposalFragmentLike[]) {
    const item = mapDroposal(p)
    if (item) items.push(item)
  }

  items.sort((a, b) => b.createdAtMs - a.createdAtMs)
  return items
}

/**
 * Build a public client for the active DAO's chain using the same transport
 * config as `dao-data.ts`. Built lazily (not at module top-level) so this
 * module stays import-safe for client components.
 */
function getServerPublicClient() {
  const chain = PUBLIC_DEFAULT_CHAINS.find((c) => c.id === daoConfig.chainId)
  if (!chain) return null
  return createPublicClient({
    chain,
    transport:
      transports[daoConfig.chainId as keyof typeof transports] ?? transports[8453],
  })
}

/**
 * Fetch a single droposal by its proposalNumber and resolve the deployed drop
 * contract address from the execution receipt (the Zora edition is the contract
 * that emits the first log of the deploy tx). Server-only — uses a public client.
 */
export async function getDroposalByNumber(
  proposalNumber: number
): Promise<DroposalDetailData | null> {
  const resp = await SubgraphSDK.connect(daoConfig.chainId).proposals({
    where: {
      dao: daoConfig.addresses.token.toLowerCase(),
      proposalNumber,
    } as never,
    first: 1,
  })

  const fragment = resp.proposals[0] as unknown as ProposalFragmentLike | undefined
  if (!fragment) return null

  const base = mapDroposal(fragment)
  if (!base) return null

  // Re-decode the droposal tx to pull royalty + sale window (not on the list item).
  const targets = (fragment.targets ?? []) as unknown[]
  const calldatas = toCalldataArray(fragment.calldatas)
  const values = (fragment.values ?? []) as unknown[]
  let royaltyBps = 0
  let saleStartMs = 0
  let saleEndMs = 0
  for (let i = 0; i < targets.length; i++) {
    const decoded = decodeProposalTx(
      {
        target: String(targets[i]),
        calldata: calldatas[i] != null ? String(calldatas[i]) : '0x',
        valueWei: BigInt(values[i] != null ? String(values[i]) : '0'),
      },
      daoConfig.chainId
    )
    if (decoded.type !== 'droposal') continue
    royaltyBps = decoded.royaltyBps
    saleStartMs = decoded.saleStartUnix ? decoded.saleStartUnix * 1000 : 0
    saleEndMs = decoded.saleEndUnix ? decoded.saleEndUnix * 1000 : 0
    break
  }

  // Resolve the deployed drop address from the execution receipt. The Zora
  // edition is surfaced as the address that emitted the first log of the deploy
  // tx (mirrors the Gnars droposals/[id] receipt read). Any failure => null.
  let dropAddress: `0x${string}` | null = null
  const execHash = base.executionTransactionHash
  if (execHash && execHash.startsWith('0x')) {
    try {
      const client = getServerPublicClient()
      if (client) {
        const receipt = await client.getTransactionReceipt({
          hash: execHash as `0x${string}`,
        })
        dropAddress = receipt.logs?.[0]?.address ?? null
      }
    } catch {
      dropAddress = null
    }
  }

  return {
    ...base,
    royaltyBps,
    saleStartMs,
    saleEndMs,
    dropAddress,
  }
}
