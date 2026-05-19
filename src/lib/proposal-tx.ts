import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
} from 'viem'

import type { Tx } from '@/lib/proposal-validation'
import { isHex } from '@/lib/proposal-validation'

export type TxKind = 'eth' | 'erc20' | 'custom'

export type TxDraftEth = {
  kind: 'eth'
  recipient: string
  valueEth: string
}

export type TxDraftErc20 = {
  kind: 'erc20'
  token: string
  recipient: string
  amount: string
}

export type TxDraftCustom = {
  kind: 'custom'
  target: string
  valueEth: string
  calldata: string
}

export type TxDraft = TxDraftEth | TxDraftErc20 | TxDraftCustom

export const TX_KIND_LABELS: Record<TxKind, string> = {
  eth: 'Send ETH',
  erc20: 'Send ERC-20',
  custom: 'Custom call',
}

export function emptyDraft(kind: TxKind): TxDraft {
  if (kind === 'eth') return { kind: 'eth', recipient: '', valueEth: '0' }
  if (kind === 'erc20') return { kind: 'erc20', token: '', recipient: '', amount: '' }
  return { kind: 'custom', target: '', valueEth: '0', calldata: '0x' }
}

export type TokenMeta = { decimals: number; symbol?: string }
export type TokenMetaMap = Record<string, TokenMeta | undefined>

export function tokenKey(addr: string): string {
  return addr.toLowerCase()
}

/** Validate a single draft. Returns a list of human-readable error strings. */
export function validateDraft(draft: TxDraft, tokenMeta: TokenMetaMap): string[] {
  const errs: string[] = []
  if (draft.kind === 'eth') {
    if (!draft.recipient || !isAddress(draft.recipient)) {
      errs.push('Recipient must be a valid address.')
    }
    if (!draft.valueEth.trim() || !isFiniteNumber(draft.valueEth)) {
      errs.push('Amount must be a number.')
    } else {
      try {
        parseEther(draft.valueEth)
      } catch {
        errs.push('Amount is not a valid ETH value.')
      }
    }
  } else if (draft.kind === 'erc20') {
    if (!draft.token || !isAddress(draft.token)) {
      errs.push('Token must be a valid address.')
    }
    if (!draft.recipient || !isAddress(draft.recipient)) {
      errs.push('Recipient must be a valid address.')
    }
    if (!draft.amount.trim() || !isFiniteNumber(draft.amount)) {
      errs.push('Amount must be a number.')
    }
    if (isAddress(draft.token)) {
      const meta = tokenMeta[tokenKey(draft.token)]
      if (!meta) {
        errs.push("Couldn't read decimals for this token yet.")
      } else if (isFiniteNumber(draft.amount)) {
        try {
          parseUnits(draft.amount, meta.decimals)
        } catch {
          errs.push('Amount has more precision than this token supports.')
        }
      }
    }
  } else {
    if (!draft.target || !isAddress(draft.target)) {
      errs.push('Target must be a valid address.')
    }
    if (draft.calldata && !isHex(draft.calldata)) {
      errs.push('Calldata must be 0x-prefixed hex.')
    }
    if (draft.valueEth && !isFiniteNumber(draft.valueEth)) {
      errs.push('Value must be a number.')
    }
  }
  return errs
}

/**
 * Encode a draft to the final shape governor.propose expects.
 * Returns the encoded Tx, or null when the draft is incomplete/invalid.
 *
 * Encoder consumers should run validateDraft() first and surface those
 * errors; encode() returns null silently so it's safe to call mid-typing.
 */
export function encodeDraft(draft: TxDraft, tokenMeta: TokenMetaMap): Tx | null {
  if (draft.kind === 'eth') {
    if (!isAddress(draft.recipient)) return null
    return {
      target: getAddress(draft.recipient),
      valueEth: draft.valueEth.trim() || '0',
      calldata: '0x',
    }
  }
  if (draft.kind === 'erc20') {
    if (!isAddress(draft.token) || !isAddress(draft.recipient)) return null
    const meta = tokenMeta[tokenKey(draft.token)]
    if (!meta) return null
    let amount: bigint
    try {
      amount = parseUnits(draft.amount.trim() || '0', meta.decimals)
    } catch {
      return null
    }
    const calldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(draft.recipient), amount],
    })
    return {
      target: getAddress(draft.token),
      valueEth: '0',
      calldata,
    }
  }
  return {
    target: draft.target,
    valueEth: draft.valueEth,
    calldata: draft.calldata || '0x',
  }
}

/** Collect the unique ERC-20 token addresses referenced across drafts. */
export function uniqueErc20Tokens(drafts: TxDraft[]): `0x${string}`[] {
  const seen = new Set<string>()
  const out: `0x${string}`[] = []
  for (const d of drafts) {
    if (d.kind !== 'erc20') continue
    if (!isAddress(d.token)) continue
    const key = tokenKey(d.token)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(getAddress(d.token))
  }
  return out
}

function isFiniteNumber(s: string): boolean {
  if (!s.trim()) return false
  const n = Number(s)
  return Number.isFinite(n) && n >= 0
}
