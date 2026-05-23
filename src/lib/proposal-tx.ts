import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
} from 'viem'

const erc721Abi = [
  {
    name: 'safeTransferFrom',
    type: 'function',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const mintToAbi = [
  {
    name: 'mintTo',
    type: 'function',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

const delegateAbi = [
  {
    name: 'delegate',
    type: 'function',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const pauseAbi = [
  { name: 'pause', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'unpause', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

const zoraNftCreatorAbi = [
  {
    name: 'createEdition',
    type: 'function',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'editionSize', type: 'uint64' },
      { name: 'royaltyBPS', type: 'uint16' },
      { name: 'fundsRecipient', type: 'address' },
      { name: 'defaultAdmin', type: 'address' },
      {
        name: 'saleConfig', type: 'tuple',
        components: [
          { name: 'publicSalePrice', type: 'uint104' },
          { name: 'maxSalePurchasePerAddress', type: 'uint32' },
          { name: 'publicSaleStart', type: 'uint64' },
          { name: 'publicSaleEnd', type: 'uint64' },
          { name: 'presaleStart', type: 'uint64' },
          { name: 'presaleEnd', type: 'uint64' },
          { name: 'presaleMerkleRoot', type: 'bytes32' },
        ],
      },
      { name: 'description', type: 'string' },
      { name: 'animationURI', type: 'string' },
      { name: 'imageURI', type: 'string' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const

const sablierLLAbi = [
  {
    name: 'createWithDurationsLL',
    type: 'function',
    inputs: [
      {
        name: 'params', type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'totalAmount', type: 'uint128' },
          { name: 'asset', type: 'address' },
          { name: 'cancelable', type: 'bool' },
          { name: 'transferable', type: 'bool' },
          {
            name: 'durations', type: 'tuple',
            components: [
              { name: 'cliff', type: 'uint40' },
              { name: 'total', type: 'uint40' },
            ],
          },
          {
            name: 'broker', type: 'tuple',
            components: [
              { name: 'account', type: 'address' },
              { name: 'fee', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: 'streamId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

import type { Tx } from '@/lib/proposal-validation'
import { isHex } from '@/lib/proposal-validation'

export type TxKind =
  | 'eth'
  | 'erc20'
  | 'nft'
  | 'custom'
  | 'stream'
  | 'airdrop'
  | 'milestone'
  | 'mint_gov'
  | 'delegate'
  | 'pause_auction'
  | 'walletconnect'
  | 'pin_asset'
  | 'droposal'
  | 'add_artwork'
  | 'replace_artwork'

/** Kinds that share the same target+valueEth+calldata structure as 'custom'. */
export const CUSTOM_LIKE_KINDS = new Set<TxKind>([
  'airdrop',
  'milestone',
  'walletconnect',
  'pin_asset',
  'add_artwork',
  'replace_artwork',
])

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

export type TxDraftNft = {
  kind: 'nft'
  contract: string
  tokenId: string
  recipient: string
}

export type TxDraftMintGov = {
  kind: 'mint_gov'
  recipient: string
}

export type TxDraftDelegate = {
  kind: 'delegate'
  delegatee: string
}

export type TxDraftPauseAuction = {
  kind: 'pause_auction'
  action: 'pause' | 'unpause'
}

export type TxDraftDroposal = {
  kind: 'droposal'
  /** Zora NFT Creator contract address (chain-specific, user-provided). */
  zoraNftCreator: string
  name: string
  symbol: string
  description: string
  imageUri: string
  priceEth: string
  /** Empty string = unlimited (type: open edition). */
  editionSize: string
  /** datetime-local string; empty = start immediately (unix 0). */
  saleStart: string
  /** datetime-local string; empty = no end (max uint64). */
  saleEnd: string
  /** Empty string = 0 (no per-wallet cap). */
  mintLimitPerAddress: string
  /** 0–10, converted to basis points ×100. */
  royaltyPercent: string
  fundsRecipient: string
  /** Empty = treasury becomes admin. */
  defaultAdmin: string
}

export type TxDraftStream = {
  kind: 'stream'
  /** Sablier LockupLinear contract address (chain-specific, user-provided). */
  sablierLL: string
  token: string
  recipient: string
  totalAmount: string
  durationDays: string
  /** Empty = no cliff. */
  cliffDays: string
  cancelable: boolean
}

// Custom-like draft: identical structure, different kind discriminant.
type CustomLikeKind = 'airdrop' | 'milestone' | 'walletconnect' | 'pin_asset' | 'add_artwork' | 'replace_artwork'

export type TxDraftCustomLike = {
  [K in CustomLikeKind]: { kind: K; target: string; valueEth: string; calldata: string }
}[CustomLikeKind]

export type TxDraft =
  | TxDraftEth
  | TxDraftErc20
  | TxDraftNft
  | TxDraftCustom
  | TxDraftMintGov
  | TxDraftDelegate
  | TxDraftPauseAuction
  | TxDraftDroposal
  | TxDraftStream
  | TxDraftCustomLike

export const TX_KIND_LABELS: Record<TxKind, string> = {
  eth: 'Send ETH',
  erc20: 'Send ERC-20',
  nft: 'Send NFT',
  custom: 'Custom Transaction',
  stream: 'Stream Tokens',
  airdrop: 'Airdrop Tokens',
  milestone: 'Milestone Payments',
  mint_gov: 'Mint Governance Tokens',
  delegate: 'Nominate Delegate',
  pause_auction: 'Pause Auctions',
  walletconnect: 'WalletConnect',
  pin_asset: 'Pin Treasury Asset',
  droposal: 'Droposal: Single Edition',
  add_artwork: 'Add Artwork',
  replace_artwork: 'Replace Artwork',
}

export function emptyDraft(kind: TxKind): TxDraft {
  if (kind === 'eth') return { kind: 'eth', recipient: '', valueEth: '0' }
  if (kind === 'erc20') return { kind: 'erc20', token: '', recipient: '', amount: '' }
  if (kind === 'nft') return { kind: 'nft', contract: '', tokenId: '', recipient: '' }
  if (kind === 'mint_gov') return { kind: 'mint_gov', recipient: '' }
  if (kind === 'delegate') return { kind: 'delegate', delegatee: '' }
  if (kind === 'pause_auction') return { kind: 'pause_auction', action: 'pause' }
  if (kind === 'droposal') return {
    kind: 'droposal', zoraNftCreator: '', name: '', symbol: '', description: '',
    imageUri: '', priceEth: '0', editionSize: '', saleStart: '', saleEnd: '',
    mintLimitPerAddress: '', royaltyPercent: '5', fundsRecipient: '', defaultAdmin: '',
  }
  if (kind === 'stream') return {
    kind: 'stream', sablierLL: '', token: '', recipient: '', totalAmount: '',
    durationDays: '', cliffDays: '', cancelable: true,
  }
  if (CUSTOM_LIKE_KINDS.has(kind)) {
    return { kind: kind as CustomLikeKind, target: '', valueEth: '0', calldata: '0x' }
  }
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
  } else if (draft.kind === 'nft') {
    if (!draft.contract || !isAddress(draft.contract)) {
      errs.push('Contract must be a valid address.')
    }
    if (!draft.recipient || !isAddress(draft.recipient)) {
      errs.push('Recipient must be a valid address.')
    }
    if (!draft.tokenId.trim()) {
      errs.push('Token ID is required.')
    } else if (!/^\d+$/.test(draft.tokenId.trim())) {
      errs.push('Token ID must be a whole number.')
    }
  } else if (draft.kind === 'mint_gov') {
    if (!draft.recipient || !isAddress(draft.recipient)) {
      errs.push('Recipient must be a valid address.')
    }
  } else if (draft.kind === 'delegate') {
    if (!draft.delegatee || !isAddress(draft.delegatee)) {
      errs.push('Delegate address must be valid.')
    }
  } else if (draft.kind === 'pause_auction') {
    // no fields to validate
  } else if (draft.kind === 'droposal') {
    if (!draft.zoraNftCreator || !isAddress(draft.zoraNftCreator))
      errs.push('Zora NFT Creator address is required.')
    if (!draft.name.trim()) errs.push('Edition name is required.')
    if (!draft.symbol.trim()) errs.push('Symbol is required.')
    if (!draft.fundsRecipient || !isAddress(draft.fundsRecipient))
      errs.push('Funds recipient must be a valid address.')
    if (draft.defaultAdmin && !isAddress(draft.defaultAdmin))
      errs.push('Default admin must be a valid address.')
    const rp = Number(draft.royaltyPercent)
    if (!isFinite(rp) || rp < 0 || rp > 10)
      errs.push('Royalty must be between 0 and 10%.')
    if (!draft.priceEth.trim() || !isFiniteNumber(draft.priceEth))
      errs.push('Mint price must be a number.')
    if (draft.editionSize.trim() && !/^\d+$/.test(draft.editionSize.trim()))
      errs.push('Edition size must be a whole number.')
  } else if (draft.kind === 'stream') {
    if (!draft.sablierLL || !isAddress(draft.sablierLL))
      errs.push('Sablier LockupLinear contract address is required.')
    if (!draft.token || !isAddress(draft.token))
      errs.push('Token must be a valid address.')
    if (!draft.recipient || !isAddress(draft.recipient))
      errs.push('Recipient must be a valid address.')
    if (!draft.totalAmount.trim() || !isFiniteNumber(draft.totalAmount))
      errs.push('Total amount must be a number.')
    if (isAddress(draft.token)) {
      const meta = tokenMeta[tokenKey(draft.token)]
      if (!meta) errs.push("Couldn't read decimals for this token yet.")
    }
    if (!draft.durationDays.trim() || !isFiniteNumber(draft.durationDays))
      errs.push('Duration must be a number of days.')
    if (draft.cliffDays.trim() && !isFiniteNumber(draft.cliffDays))
      errs.push('Cliff must be a number of days.')
  } else {
    // custom + all custom-like kinds
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
 * ctx.token and ctx.auction are required for mint_gov, delegate, pause_auction.
 */
export function encodeDraft(
  draft: TxDraft,
  tokenMeta: TokenMetaMap,
  ctx: { treasury: string; token?: string; auction?: string } = { treasury: '' }
): Tx | null {
  if (draft.kind === 'eth') {
    if (!isAddress(draft.recipient)) return null
    return {
      target: getAddress(draft.recipient),
      valueEth: draft.valueEth.trim() || '0',
      calldata: '0x',
    }
  }

  if (draft.kind === 'nft') {
    if (!isAddress(draft.contract) || !isAddress(draft.recipient) || !draft.tokenId.trim())
      return null
    if (!isAddress(ctx.treasury)) return null
    const calldata = encodeFunctionData({
      abi: erc721Abi,
      functionName: 'safeTransferFrom',
      args: [getAddress(ctx.treasury), getAddress(draft.recipient), BigInt(draft.tokenId)],
    })
    return { target: getAddress(draft.contract), valueEth: '0', calldata }
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
    return { target: getAddress(draft.token), valueEth: '0', calldata }
  }

  if (draft.kind === 'mint_gov') {
    if (!isAddress(draft.recipient)) return null
    if (!ctx.token || !isAddress(ctx.token)) return null
    const calldata = encodeFunctionData({
      abi: mintToAbi,
      functionName: 'mintTo',
      args: [getAddress(draft.recipient)],
    })
    return { target: getAddress(ctx.token), valueEth: '0', calldata }
  }

  if (draft.kind === 'delegate') {
    if (!isAddress(draft.delegatee)) return null
    if (!ctx.token || !isAddress(ctx.token)) return null
    const calldata = encodeFunctionData({
      abi: delegateAbi,
      functionName: 'delegate',
      args: [getAddress(draft.delegatee)],
    })
    return { target: getAddress(ctx.token), valueEth: '0', calldata }
  }

  if (draft.kind === 'pause_auction') {
    if (!ctx.auction || !isAddress(ctx.auction)) return null
    const calldata = encodeFunctionData({
      abi: pauseAbi,
      functionName: draft.action,
    })
    return { target: getAddress(ctx.auction), valueEth: '0', calldata }
  }

  if (draft.kind === 'droposal') {
    if (!isAddress(draft.zoraNftCreator) || !isAddress(draft.fundsRecipient)) return null
    if (!draft.name.trim() || !draft.symbol.trim()) return null
    const admin =
      draft.defaultAdmin && isAddress(draft.defaultAdmin)
        ? getAddress(draft.defaultAdmin)
        : getAddress(ctx.treasury)
    const editionSize = draft.editionSize.trim()
      ? BigInt(draft.editionSize)
      : BigInt('18446744073709551615')
    const saleStart = draft.saleStart
      ? BigInt(Math.floor(new Date(draft.saleStart).getTime() / 1000))
      : BigInt(0)
    const saleEnd = draft.saleEnd
      ? BigInt(Math.floor(new Date(draft.saleEnd).getTime() / 1000))
      : BigInt('18446744073709551615')
    const calldata = encodeFunctionData({
      abi: zoraNftCreatorAbi,
      functionName: 'createEdition',
      args: [
        draft.name,
        draft.symbol,
        editionSize,
        Math.round(Number(draft.royaltyPercent) * 100),
        getAddress(draft.fundsRecipient),
        admin,
        {
          publicSalePrice: parseEther(draft.priceEth || '0'),
          maxSalePurchasePerAddress: draft.mintLimitPerAddress
            ? Number(draft.mintLimitPerAddress)
            : 0,
          publicSaleStart: saleStart,
          publicSaleEnd: saleEnd,
          presaleStart: BigInt(0),
          presaleEnd: BigInt(0),
          presaleMerkleRoot:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
        draft.description,
        '',
        draft.imageUri,
      ],
    })
    return { target: getAddress(draft.zoraNftCreator), valueEth: '0', calldata }
  }

  if (draft.kind === 'stream') {
    if (!isAddress(draft.sablierLL) || !isAddress(draft.token) || !isAddress(draft.recipient))
      return null
    if (!isAddress(ctx.treasury)) return null
    const meta = tokenMeta[tokenKey(draft.token)]
    if (!meta) return null
    let totalAmount: bigint
    try {
      totalAmount = parseUnits(draft.totalAmount.trim() || '0', meta.decimals)
    } catch {
      return null
    }
    const durationSecs = Math.round(Number(draft.durationDays) * 86400)
    const cliffSecs = draft.cliffDays.trim() ? Math.round(Number(draft.cliffDays) * 86400) : 0
    const calldata = encodeFunctionData({
      abi: sablierLLAbi,
      functionName: 'createWithDurationsLL',
      args: [
        {
          sender: getAddress(ctx.treasury),
          recipient: getAddress(draft.recipient),
          totalAmount,
          asset: getAddress(draft.token),
          cancelable: draft.cancelable,
          transferable: true,
          durations: { cliff: cliffSecs, total: durationSecs },
          broker: {
            account: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            fee: BigInt(0),
          },
        },
      ],
    })
    return { target: getAddress(draft.sablierLL), valueEth: '0', calldata }
  }

  // custom + all custom-like kinds
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
    const addr =
      d.kind === 'erc20' ? d.token : d.kind === 'stream' ? d.token : null
    if (!addr || !isAddress(addr)) continue
    const key = tokenKey(addr)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(getAddress(addr))
  }
  return out
}

function isFiniteNumber(s: string): boolean {
  if (!s.trim()) return false
  const n = Number(s)
  return Number.isFinite(n) && n >= 0
}
