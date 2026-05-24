'use client'

import { erc20Abi, getAddress, isAddress, parseUnits } from 'viem'
import { useReadContracts } from 'wagmi'

import { daoConfig } from '@/lib/dao.config'
import {
  tokenKey,
  type TokenMetaMap,
  type TxDraft,
  ZERO_ADDRESS,
} from '@/lib/proposal-tx'

const erc721OwnerAbi = [
  {
    name: 'ownerOf',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

export type FeasibilityWarning = {
  /** Display id — keyed for React. */
  id: string
  severity: 'warning'
  message: string
}

type Erc20Check = {
  kind: 'erc20'
  token: `0x${string}`
  symbol: string
  required: bigint
  decimals: number
}
type NftCheck = { kind: 'nft'; index: number; contract: `0x${string}`; tokenId: bigint }

/**
 * Collect treasury balance / NFT ownership checks from the queued drafts.
 * Returns warnings that should block (or at least flag) submission.
 */
export function useProposalFeasibility(
  drafts: TxDraft[],
  tokenMeta: TokenMetaMap
): { warnings: FeasibilityWarning[]; loading: boolean } {
  const treasury = daoConfig.addresses.treasury

  // ── Compute outflows ─────────────────────────────────────────────────────
  let ethRequired = BigInt(0)
  const erc20Required = new Map<string, bigint>()
  const erc20Decimals = new Map<string, number>()
  const erc20Symbols = new Map<string, string>()
  const nftChecks: NftCheck[] = []

  const ensureErc20 = (token: string): boolean => {
    const k = tokenKey(token)
    if (erc20Decimals.has(k)) return true
    const meta = tokenMeta[k]
    if (!meta) return false
    erc20Decimals.set(k, meta.decimals)
    erc20Symbols.set(k, meta.symbol ?? '')
    erc20Required.set(k, BigInt(0))
    return true
  }

  const addErc20 = (token: string, amount: string): void => {
    if (!isAddress(token)) return
    if (token.toLowerCase() === ZERO_ADDRESS) return
    if (!ensureErc20(token)) return
    const k = tokenKey(token)
    try {
      const parsed = parseUnits(amount || '0', erc20Decimals.get(k)!)
      erc20Required.set(k, (erc20Required.get(k) ?? BigInt(0)) + parsed)
    } catch {
      // skip
    }
  }

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]
    if (d.kind === 'eth') {
      const n = Number(d.valueEth)
      if (Number.isFinite(n) && n > 0) {
        try {
          ethRequired += parseUnits(d.valueEth || '0', 18)
        } catch {
          // ignore
        }
      }
    } else if (d.kind === 'erc20') {
      addErc20(d.token, d.amount)
    } else if (d.kind === 'stream') {
      addErc20(d.token, d.totalAmount)
    } else if (d.kind === 'milestone') {
      if (d.token.toLowerCase() === ZERO_ADDRESS) {
        const total = d.milestones
          .map((m) => Number(m.amount))
          .filter((n) => Number.isFinite(n))
          .reduce((a, b) => a + b, 0)
        if (total > 0) {
          try {
            ethRequired += parseUnits(total.toString(), 18)
          } catch {
            // ignore
          }
        }
      } else {
        const total = d.milestones
          .map((m) => m.amount)
          .filter((amt) => amt && Number.isFinite(Number(amt)))
        for (const amt of total) addErc20(d.token, amt)
      }
    } else if (d.kind === 'airdrop') {
      if (d.token.toLowerCase() === ZERO_ADDRESS) {
        const total = d.recipients
          .map((r) => Number(r.amount))
          .filter((n) => Number.isFinite(n))
          .reduce((a, b) => a + b, 0)
        if (total > 0) {
          try {
            ethRequired += parseUnits(total.toString(), 18)
          } catch {
            // ignore
          }
        }
      } else {
        for (const r of d.recipients) addErc20(d.token, r.amount)
      }
    } else if (d.kind === 'nft') {
      if (isAddress(d.contract) && /^\d+$/.test(d.tokenId.trim())) {
        nftChecks.push({
          kind: 'nft',
          index: i,
          contract: getAddress(d.contract) as `0x${string}`,
          tokenId: BigInt(d.tokenId),
        })
      }
    }
  }

  const erc20CheckList: Erc20Check[] = Array.from(erc20Required.entries()).map(
    ([k, required]) => ({
      kind: 'erc20',
      token: getAddress(k) as `0x${string}`,
      symbol: erc20Symbols.get(k) || '',
      required,
      decimals: erc20Decimals.get(k)!,
    })
  )

  // ── Build batched reads ──────────────────────────────────────────────────
  const contracts = [
    // ETH balance via the multicall3 helper isn't part of erc20Abi; we
    // approximate by reading WETH? Better: just skip ETH balance from the
    // multicall and rely on wagmi useBalance separately. For simplicity here,
    // we issue erc20.balanceOf for each token, then a separate hook for ETH.
    ...erc20CheckList.map((c) => ({
      address: c.token,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [treasury as `0x${string}`] as const,
      chainId: daoConfig.chainId,
    })),
    ...nftChecks.map((c) => ({
      address: c.contract,
      abi: erc721OwnerAbi,
      functionName: 'ownerOf' as const,
      args: [c.tokenId] as const,
      chainId: daoConfig.chainId,
    })),
  ]

  const { data: reads, isLoading } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  })

  // Treasury ETH balance — separate read so we don't have to mix erc20Abi.
  const { data: ethBalance, isLoading: ethLoading } = useReadContracts({
    contracts: [
      {
        // wagmi exposes `useBalance` but mixing hook kinds risks ordering; the
        // multicall3 `getEthBalance` works on every chain where multicall3 is
        // deployed (basically everywhere modern). Fall back to undefined when
        // not available.
        address: '0xcA11bde05977b3631167028862bE2a173976CA11',
        abi: [
          {
            name: 'getEthBalance',
            type: 'function',
            inputs: [{ name: 'addr', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
            stateMutability: 'view',
          },
        ] as const,
        functionName: 'getEthBalance' as const,
        args: [treasury as `0x${string}`] as const,
        chainId: daoConfig.chainId,
      },
    ],
    query: { enabled: ethRequired > BigInt(0) },
  })

  const warnings: FeasibilityWarning[] = []

  // ETH balance check
  if (ethRequired > BigInt(0)) {
    const bal = ethBalance?.[0]
    if (bal?.status === 'success' && (bal.result as bigint) < ethRequired) {
      const balEth = formatBig(bal.result as bigint, 18, 4)
      const reqEth = formatBig(ethRequired, 18, 4)
      warnings.push({
        id: 'eth',
        severity: 'warning',
        message: `Treasury ETH balance (${balEth}) is below the total ETH required by this proposal (${reqEth}). The transaction will revert at execution time.`,
      })
    }
  }

  // ERC-20 balance checks
  erc20CheckList.forEach((c, i) => {
    const read = reads?.[i]
    if (read?.status === 'success' && (read.result as bigint) < c.required) {
      const bal = formatBig(read.result as bigint, c.decimals, 4)
      const req = formatBig(c.required, c.decimals, 4)
      warnings.push({
        id: `erc20-${c.token}`,
        severity: 'warning',
        message: `Treasury ${c.symbol || c.token} balance (${bal}) is below the required amount (${req}).`,
      })
    }
  })

  // NFT ownership checks
  nftChecks.forEach((c, i) => {
    const read = reads?.[erc20CheckList.length + i]
    if (read?.status === 'success') {
      const owner = (read.result as string).toLowerCase()
      if (owner !== treasury.toLowerCase()) {
        warnings.push({
          id: `nft-${c.contract}-${c.tokenId}`,
          severity: 'warning',
          message: `Treasury does not own token #${c.tokenId} of ${c.contract} (current owner: ${owner}). Tx ${c.index + 1} will revert.`,
        })
      }
    } else if (read?.status === 'failure') {
      warnings.push({
        id: `nft-${c.contract}-${c.tokenId}-missing`,
        severity: 'warning',
        message: `Token #${c.tokenId} of ${c.contract} doesn't appear to exist. Tx ${c.index + 1} will likely revert.`,
      })
    }
  })

  return { warnings, loading: isLoading || ethLoading }
}

function formatBig(v: bigint, decimals: number, maxFrac = 4): string {
  const base = BigInt(10) ** BigInt(decimals)
  const whole = v / base
  const frac = v % base
  if (frac === BigInt(0)) return whole.toString()
  const fracStr = frac
    .toString()
    .padStart(decimals, '0')
    .slice(0, maxFrac)
    .replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}
