import {
  EAS_CONTRACT_ADDRESS,
  easAbi,
  ESCROW_DELEGATE_SCHEMA,
  ESCROW_DELEGATE_SCHEMA_UID,
  TREASURY_ASSET_PIN_SCHEMA,
  TREASURY_ASSET_PIN_SCHEMA_UID,
} from '@buildeross/constants/eas'
import {
  convertIpfsCidV0ToByte32,
  deployEscrowAbi,
  ESCROW_REQUIRE_VERIFICATION,
  ESCROW_RESOLVER_TYPE,
  ESCROW_TYPE,
  getEscrowBundler,
  getWrappedTokenAddress,
  SMART_INVOICE_ARBITRATION_PROVIDER,
} from '@buildeross/utils/escrow'
import {
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseAbiParameters,
  parseEther,
  parseUnits,
  zeroHash,
} from 'viem'

import { daoConfig } from '@/lib/dao.config'

type ChainId = keyof typeof EAS_CONTRACT_ADDRESS

/** EAS contract address for the current DAO's chain, if supported. */
function easAddress(): `0x${string}` | null {
  return (
    daoConfig.contractOverrides?.eas ??
    EAS_CONTRACT_ADDRESS[daoConfig.chainId as ChainId] ??
    null
  )
}

/** EAS supported on the current chain? */
export function isEasSupported(): boolean {
  return easAddress() !== null
}

/** EscrowBundler supported on the current chain? */
export function isEscrowSupported(): boolean {
  if (daoConfig.contractOverrides?.escrowBundler) return true
  try {
    return !!getEscrowBundler(daoConfig.chainId)
  } catch {
    return false
  }
}

function resolvedEscrowBundler(): `0x${string}` | null {
  if (daoConfig.contractOverrides?.escrowBundler)
    return daoConfig.contractOverrides.escrowBundler
  try {
    return getEscrowBundler(daoConfig.chainId) as `0x${string}`
  } catch {
    return null
  }
}

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

const pauseAbi = [
  {
    name: 'pause',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'unpause',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
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
        name: 'saleConfig',
        type: 'tuple',
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
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'totalAmount', type: 'uint128' },
          { name: 'asset', type: 'address' },
          { name: 'cancelable', type: 'bool' },
          { name: 'transferable', type: 'bool' },
          {
            name: 'durations',
            type: 'tuple',
            components: [
              { name: 'cliff', type: 'uint40' },
              { name: 'total', type: 'uint40' },
            ],
          },
          {
            name: 'broker',
            type: 'tuple',
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
  'walletconnect',
  'add_artwork',
  'replace_artwork',
])

/**
 * Disperse.app contract address per supported chain. The same address is
 * shared across most EVM chains via CREATE2; Base is one of the exceptions.
 * Override via daoConfig if a fork needs a different deployer.
 */
const DISPERSE_ADDRESSES: Record<number, `0x${string}` | undefined> = {
  1: '0xD152f549545093347A162Dce210e7293f1452150', // mainnet
  10: '0xD152f549545093347A162Dce210e7293f1452150', // optimism
  137: '0xD152f549545093347A162Dce210e7293f1452150', // polygon
  42161: '0xD152f549545093347A162Dce210e7293f1452150', // arbitrum
  8453: '0xD152f549545093347A162Dce210e7293f1452150', // base
}

export function disperseAddress(chainId: number): `0x${string}` | null {
  // Override takes priority — only honored when the active chain matches.
  if (chainId === daoConfig.chainId && daoConfig.contractOverrides?.disperse) {
    return daoConfig.contractOverrides.disperse
  }
  return DISPERSE_ADDRESSES[chainId] ?? null
}

export function isAirdropSupported(): boolean {
  return disperseAddress(daoConfig.chainId) !== null
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function cidToByte32(cid?: string): `0x${string}` {
  if (!cid || !cid.trim()) return zeroHash
  try {
    return convertIpfsCidV0ToByte32(cid.trim()) as `0x${string}`
  } catch {
    return zeroHash
  }
}

const disperseAbi = [
  {
    name: 'disperseEther',
    type: 'function',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'disperseToken',
    type: 'function',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

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

export type PinAssetTokenType = 'erc20' | 'erc721' | 'erc1155'

export type TxDraftPinAsset = {
  kind: 'pin_asset'
  tokenType: PinAssetTokenType
  contract: string
  /** When true, pin the whole collection (tokenId ignored). */
  isCollection: boolean
  /** Numeric token id; ignored when isCollection or tokenType==='erc20'. */
  tokenId: string
}

export type AirdropEntry = {
  recipient: string
  amount: string
}

export type TxDraftAirdrop = {
  kind: 'airdrop'
  /** Token address — use the zero-address sentinel for native ETH. */
  token: string
  recipients: AirdropEntry[]
}

export type MilestoneEntry = {
  /** Token amount as a string (interpreted with token decimals). */
  amount: string
  title: string
  description: string
  /** YYYY-MM-DD date string. */
  endDate: string
}

export type TxDraftMilestone = {
  kind: 'milestone'
  /** Token address (use the zero address sentinel for native ETH). */
  token: string
  /** Who receives the funds when milestones are released. */
  recipient: string
  /** Who controls release of milestone funds (DAO multisig or treasury). */
  client: string
  /** YYYY-MM-DD safety valve — after this date, the client can reclaim. */
  safetyValveDate: string
  milestones: MilestoneEntry[]
  /**
   * IPFS CID (v0) of the uploaded SmartInvoice metadata. Optional — when
   * absent, the encoder uses zeroHash and the off-chain UI loses titles
   * and descriptions but the escrow still functions on-chain.
   */
  ipfsCid?: string
}

// Custom-like draft: identical structure, different kind discriminant.
type CustomLikeKind = 'walletconnect' | 'add_artwork' | 'replace_artwork'

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
  | TxDraftPinAsset
  | TxDraftMilestone
  | TxDraftAirdrop
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
  if (kind === 'droposal')
    return {
      kind: 'droposal',
      zoraNftCreator: daoConfig.contractOverrides?.zoraNftCreator ?? '',
      name: '',
      symbol: '',
      description: '',
      imageUri: '',
      priceEth: '0',
      editionSize: '',
      saleStart: '',
      saleEnd: '',
      mintLimitPerAddress: '',
      royaltyPercent: '5',
      fundsRecipient: '',
      defaultAdmin: '',
    }
  if (kind === 'stream')
    return {
      kind: 'stream',
      sablierLL: daoConfig.contractOverrides?.sablierLockupLinear ?? '',
      token: '',
      recipient: '',
      totalAmount: '',
      durationDays: '',
      cliffDays: '',
      cancelable: true,
    }
  if (kind === 'pin_asset')
    return {
      kind: 'pin_asset',
      tokenType: 'erc721',
      contract: '',
      isCollection: true,
      tokenId: '',
    }
  if (kind === 'milestone')
    return {
      kind: 'milestone',
      token: '',
      recipient: '',
      client: '',
      safetyValveDate: '',
      milestones: [{ amount: '', title: '', description: '', endDate: '' }],
    }
  if (kind === 'airdrop')
    return {
      kind: 'airdrop',
      token: '0x0000000000000000000000000000000000000000',
      recipients: [{ recipient: '', amount: '' }],
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
    if (!isEasSupported()) {
      errs.push(
        'EAS (Ethereum Attestation Service) is not deployed on this chain — escrow delegate nominations are unavailable.'
      )
    }
  } else if (draft.kind === 'milestone') {
    if (!isEscrowSupported()) {
      errs.push(
        'EscrowBundler is not deployed on this chain — milestone payments are unavailable.'
      )
    }
    if (!draft.token || !isAddress(draft.token)) {
      errs.push('Token address is required (use zero address for native ETH).')
    }
    if (!draft.recipient || !isAddress(draft.recipient)) {
      errs.push('Recipient must be a valid address.')
    }
    if (!draft.client || !isAddress(draft.client)) {
      errs.push('Client (release controller) must be a valid address.')
    } else if (
      isAddress(draft.recipient) &&
      draft.client.toLowerCase() === draft.recipient.toLowerCase()
    ) {
      errs.push('Client and recipient must be different addresses.')
    }
    if (!draft.safetyValveDate) {
      errs.push('Safety valve date is required.')
    }
    if (draft.milestones.length === 0) {
      errs.push('At least one milestone is required.')
    }
    let lastEnd = 0
    for (let i = 0; i < draft.milestones.length; i++) {
      const m = draft.milestones[i]
      if (!m.title.trim()) errs.push(`Milestone ${i + 1}: title required.`)
      if (!m.amount.trim() || !isFiniteNumber(m.amount))
        errs.push(`Milestone ${i + 1}: amount must be a number > 0.`)
      if (!m.endDate) errs.push(`Milestone ${i + 1}: delivery date required.`)
      else {
        const t = new Date(m.endDate).getTime()
        if (!Number.isFinite(t)) errs.push(`Milestone ${i + 1}: invalid date.`)
        if (t < lastEnd) errs.push(`Milestone ${i + 1}: must end after milestone ${i}.`)
        lastEnd = t
      }
    }
    if (draft.safetyValveDate) {
      const safety = new Date(draft.safetyValveDate).getTime()
      const minSafety = lastEnd + 30 * 86400 * 1000
      if (Number.isFinite(safety) && safety < minSafety) {
        errs.push('Safety valve date must be at least 30 days after the last milestone.')
      }
    }
    const isNative = isAddress(draft.token) && draft.token.toLowerCase() === ZERO_ADDRESS
    if (isAddress(draft.token) && !isNative) {
      const meta = tokenMeta[tokenKey(draft.token)]
      if (!meta) errs.push("Couldn't read decimals for this token yet.")
    }
  } else if (draft.kind === 'airdrop') {
    if (!isAirdropSupported()) {
      errs.push(
        'Disperse contract is not configured on this chain — airdrops are unavailable.'
      )
    }
    if (!draft.token || !isAddress(draft.token)) {
      errs.push('Token address is required (use zero address for native ETH).')
    }
    const isNative = isAddress(draft.token) && draft.token.toLowerCase() === ZERO_ADDRESS
    if (!isNative && isAddress(draft.token)) {
      const meta = tokenMeta[tokenKey(draft.token)]
      if (!meta) errs.push("Couldn't read decimals for this token yet.")
    }
    if (draft.recipients.length === 0) errs.push('At least one recipient is required.')
    const seen = new Set<string>()
    for (let i = 0; i < draft.recipients.length; i++) {
      const r = draft.recipients[i]
      if (!r.recipient || !isAddress(r.recipient)) {
        errs.push(`Recipient ${i + 1}: invalid address.`)
      } else {
        const k = r.recipient.toLowerCase()
        if (seen.has(k)) errs.push(`Recipient ${i + 1}: duplicate address.`)
        seen.add(k)
      }
      if (!r.amount.trim() || !isFiniteNumber(r.amount)) {
        errs.push(`Recipient ${i + 1}: amount must be a number > 0.`)
      }
    }
  } else if (draft.kind === 'pin_asset') {
    if (!draft.contract || !isAddress(draft.contract)) {
      errs.push('Asset contract must be a valid address.')
    }
    if (
      (draft.tokenType === 'erc721' || draft.tokenType === 'erc1155') &&
      !draft.isCollection &&
      !/^\d+$/.test(draft.tokenId.trim())
    ) {
      errs.push('Token ID must be a whole number when pinning a single token.')
    }
    if (!isEasSupported()) {
      errs.push(
        'EAS (Ethereum Attestation Service) is not deployed on this chain — treasury asset pinning is unavailable.'
      )
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
    if (
      !isAddress(draft.contract) ||
      !isAddress(draft.recipient) ||
      !draft.tokenId.trim()
    )
      return null
    if (!isAddress(ctx.treasury)) return null
    const calldata = encodeFunctionData({
      abi: erc721Abi,
      functionName: 'safeTransferFrom',
      args: [
        getAddress(ctx.treasury),
        getAddress(draft.recipient),
        BigInt(draft.tokenId),
      ],
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
    const eas = easAddress()
    if (!eas) return null
    const data = encodeAbiParameters(parseAbiParameters(ESCROW_DELEGATE_SCHEMA), [
      getAddress(draft.delegatee),
    ])
    const calldata = encodeFunctionData({
      abi: easAbi,
      functionName: 'attest',
      args: [
        {
          schema: ESCROW_DELEGATE_SCHEMA_UID,
          data: {
            recipient: getAddress(ctx.token),
            expirationTime: BigInt(0),
            revocable: true,
            refUID: zeroHash,
            data,
            value: BigInt(0),
          },
        },
      ],
    })
    return { target: getAddress(eas), valueEth: '0', calldata }
  }

  if (draft.kind === 'milestone') {
    if (
      !isAddress(draft.token) ||
      !isAddress(draft.recipient) ||
      !isAddress(draft.client)
    )
      return null
    if (!ctx.treasury || !isAddress(ctx.treasury)) return null
    const bundler = resolvedEscrowBundler()
    if (!bundler) return null
    const isNative = draft.token.toLowerCase() === ZERO_ADDRESS
    const wrappedToken = (() => {
      try {
        return getWrappedTokenAddress(daoConfig.chainId) as `0x${string}`
      } catch {
        return null
      }
    })()
    const tokenForEscrow = isNative
      ? wrappedToken
      : (getAddress(draft.token) as `0x${string}`)
    if (!tokenForEscrow) return null

    // Convert amounts using decimals (native ETH = 18; ERC-20 from meta).
    const decimals = isNative ? 18 : tokenMeta[tokenKey(draft.token)]?.decimals
    if (decimals == null) return null
    let amounts: bigint[]
    try {
      amounts = draft.milestones.map((m) => parseUnits(m.amount || '0', decimals))
    } catch {
      return null
    }
    const fundAmount = amounts.reduce((acc, x) => acc + x, BigInt(0))
    const safetyValveUnix = BigInt(
      Math.floor(new Date(draft.safetyValveDate).getTime() / 1000)
    )
    if (!Number.isFinite(Number(safetyValveUnix))) return null

    // SmartInvoice escrowData layout (matches the 11-field tuple used by
    // EscrowBundler). IPFS metadata CID is left as zero hash — the on-chain
    // escrow still executes; only the off-chain SmartInvoice UI degrades.
    const escrowData = encodeAbiParameters(
      parseAbiParameters(
        'address, uint8, address, address, uint256, bytes32, address, bool, address, address, address'
      ),
      [
        getAddress(draft.client),
        ESCROW_RESOLVER_TYPE,
        SMART_INVOICE_ARBITRATION_PROVIDER,
        tokenForEscrow,
        safetyValveUnix,
        cidToByte32(draft.ipfsCid),
        wrappedToken ?? tokenForEscrow,
        ESCROW_REQUIRE_VERIFICATION,
        bundler,
        getAddress(draft.recipient),
        getAddress(ctx.treasury),
      ]
    )

    const calldata = encodeFunctionData({
      abi: deployEscrowAbi,
      functionName: 'deployEscrow',
      args: [getAddress(draft.recipient), amounts, escrowData, ESCROW_TYPE, fundAmount],
    })
    return {
      target: bundler,
      valueEth: isNative
        ? draft.milestones.reduce((acc, m) => acc + Number(m.amount || '0'), 0).toString()
        : '0',
      calldata,
    }
  }

  if (draft.kind === 'airdrop') {
    if (!isAddress(draft.token)) return null
    const disperse = disperseAddress(daoConfig.chainId)
    if (!disperse) return null
    const isNative = draft.token.toLowerCase() === ZERO_ADDRESS
    const decimals = isNative ? 18 : tokenMeta[tokenKey(draft.token)]?.decimals
    if (decimals == null) return null

    let recipients: `0x${string}`[]
    let values: bigint[]
    try {
      recipients = draft.recipients.map((r) => getAddress(r.recipient))
      values = draft.recipients.map((r) => parseUnits(r.amount || '0', decimals))
    } catch {
      return null
    }
    if (recipients.length === 0) return null

    if (isNative) {
      const totalWei = values.reduce((a, b) => a + b, BigInt(0))
      const calldata = encodeFunctionData({
        abi: disperseAbi,
        functionName: 'disperseEther',
        args: [recipients, values],
      })
      return {
        target: disperse,
        valueEth: formatUnits(totalWei, 18),
        calldata,
      }
    }
    const calldata = encodeFunctionData({
      abi: disperseAbi,
      functionName: 'disperseToken',
      args: [getAddress(draft.token), recipients, values],
    })
    return { target: disperse, valueEth: '0', calldata }
  }

  if (draft.kind === 'pin_asset') {
    if (!isAddress(draft.contract)) return null
    if (!ctx.token || !isAddress(ctx.token)) return null
    const eas = easAddress()
    if (!eas) return null
    const tokenTypeNum =
      draft.tokenType === 'erc20' ? 0 : draft.tokenType === 'erc721' ? 1 : 2
    const isCollection = draft.tokenType === 'erc20' ? true : draft.isCollection
    const tokenIdBig =
      isCollection || !draft.tokenId.trim() ? BigInt(0) : BigInt(draft.tokenId)
    const data = encodeAbiParameters(parseAbiParameters(TREASURY_ASSET_PIN_SCHEMA), [
      tokenTypeNum,
      getAddress(draft.contract),
      isCollection,
      tokenIdBig,
    ])
    const calldata = encodeFunctionData({
      abi: easAbi,
      functionName: 'attest',
      args: [
        {
          schema: TREASURY_ASSET_PIN_SCHEMA_UID,
          data: {
            recipient: getAddress(ctx.token),
            expirationTime: BigInt(0),
            revocable: true,
            refUID: zeroHash,
            data,
            value: BigInt(0),
          },
        },
      ],
    })
    return { target: getAddress(eas), valueEth: '0', calldata }
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
    if (
      !isAddress(draft.sablierLL) ||
      !isAddress(draft.token) ||
      !isAddress(draft.recipient)
    )
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
    const cliffSecs = draft.cliffDays.trim()
      ? Math.round(Number(draft.cliffDays) * 86400)
      : 0
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

/**
 * Encode a draft into the *final* list of transactions to include in the
 * proposal. Most kinds return a single tx, but kinds that spend ERC-20s
 * from the treasury (milestone, stream, airdrop) auto-prepend the matching
 * `approve(spender, amount)` call so the proposer doesn't have to build it
 * by hand. Native-ETH variants of those kinds skip the approval.
 */
export function encodeDraftToTxs(
  draft: TxDraft,
  tokenMeta: TokenMetaMap,
  ctx: { treasury: string; token?: string; auction?: string } = { treasury: '' }
): Tx[] | null {
  const main = encodeDraft(draft, tokenMeta, ctx)
  if (main === null) return null
  const approval = buildApprovalDraft(draft, tokenMeta)
  if (!approval) return [main]
  return [
    { target: approval.target, valueEth: approval.valueEth, calldata: approval.calldata },
    main,
  ]
}

/**
 * Build an ERC-20 `approve(spender, amount)` draft for the source draft when
 * its token + amount can be resolved. Returns null for native ETH or for
 * source drafts that don't need an approval (eth/erc20/etc.).
 */
export function buildApprovalDraft(
  source: TxDraft,
  tokenMeta: TokenMetaMap
): TxDraftCustom | null {
  let token: string | null = null
  let amount: string | null = null
  let spender: `0x${string}` | null = null

  if (source.kind === 'stream') {
    token = source.token
    amount = source.totalAmount
    spender = isAddress(source.sablierLL)
      ? (getAddress(source.sablierLL) as `0x${string}`)
      : null
  } else if (source.kind === 'airdrop') {
    token = source.token
    spender = disperseAddress(daoConfig.chainId)
    const totals = source.recipients
      .map((r) => Number(r.amount))
      .filter((n) => Number.isFinite(n))
    if (totals.length === source.recipients.length) {
      amount = totals.reduce((a, b) => a + b, 0).toString()
    }
  } else if (source.kind === 'milestone') {
    token = source.token
    spender = resolvedEscrowBundler()
    const totals = source.milestones
      .map((m) => Number(m.amount))
      .filter((n) => Number.isFinite(n))
    if (totals.length === source.milestones.length) {
      amount = totals.reduce((a, b) => a + b, 0).toString()
    }
  } else {
    return null
  }

  if (!token || !isAddress(token)) return null
  if (token.toLowerCase() === ZERO_ADDRESS) return null // native ETH — no approval
  if (!spender || !isAddress(spender)) return null
  if (!amount) return null

  const meta = tokenMeta[tokenKey(token)]
  if (!meta) return null

  let parsed: bigint
  try {
    parsed = parseUnits(amount, meta.decimals)
  } catch {
    return null
  }

  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, parsed],
  })

  return {
    kind: 'custom',
    target: getAddress(token),
    valueEth: '0',
    calldata,
  }
}

/**
 * Render a single draft as a human-readable markdown block — used to
 * append a "Decoded transactions" section to the proposal description so
 * voters see what the call actually does without having to decode calldata.
 */
export function summarizeDraftMarkdown(
  draft: TxDraft,
  index: number,
  tokenMeta: TokenMetaMap
): string {
  const heading = `**Tx ${index + 1}: ${TX_KIND_LABELS[draft.kind]}**`
  const lines: string[] = [heading]

  if (draft.kind === 'eth') {
    lines.push(`- Send \`${draft.valueEth || '0'} ETH\` to \`${draft.recipient || '?'}\``)
  } else if (draft.kind === 'erc20') {
    const meta = tokenMeta[tokenKey(draft.token)]
    const symbol = meta?.symbol ?? 'tokens'
    lines.push(
      `- Send \`${draft.amount || '0'} ${symbol}\` to \`${draft.recipient || '?'}\``
    )
    lines.push(`- Token contract: \`${draft.token}\``)
  } else if (draft.kind === 'nft') {
    lines.push(`- Send NFT #${draft.tokenId} to \`${draft.recipient || '?'}\``)
    lines.push(`- Collection: \`${draft.contract}\``)
  } else if (draft.kind === 'mint_gov') {
    lines.push(`- Mint a governance token to \`${draft.recipient}\``)
  } else if (draft.kind === 'delegate') {
    lines.push(`- Nominate \`${draft.delegatee}\` as the DAO's escrow delegate`)
    lines.push('- Via EAS attestation (escrow-delegate schema)')
  } else if (draft.kind === 'pause_auction') {
    lines.push(
      `- **${draft.action === 'pause' ? 'Pause' : 'Unpause'}** the DAO auction house`
    )
  } else if (draft.kind === 'pin_asset') {
    const what = draft.isCollection
      ? `the ${draft.tokenType.toUpperCase()} collection`
      : `${draft.tokenType.toUpperCase()} token #${draft.tokenId}`
    lines.push(`- Pin ${what} at \`${draft.contract}\` to the treasury display`)
  } else if (draft.kind === 'droposal') {
    lines.push(`- Deploy a Zora edition: **${draft.name}** (${draft.symbol})`)
    lines.push(
      `- Mint price: \`${draft.priceEth || '0'} ETH\` · ${
        draft.editionSize ? `Size: ${draft.editionSize}` : 'Open edition'
      } · Royalty: ${draft.royaltyPercent || '0'}%`
    )
    if (draft.description) lines.push(`- "${draft.description}"`)
  } else if (draft.kind === 'stream') {
    const meta = tokenMeta[tokenKey(draft.token)]
    const symbol = meta?.symbol ?? 'tokens'
    lines.push(
      `- Stream \`${draft.totalAmount || '0'} ${symbol}\` to \`${draft.recipient}\` over ${draft.durationDays} days${
        draft.cliffDays ? ` (cliff ${draft.cliffDays} days)` : ''
      }`
    )
    lines.push(`- Cancelable: ${draft.cancelable ? 'yes' : 'no'}`)
    lines.push(
      `- (Auto-prepended: \`approve()\` to the Sablier contract for the total amount.)`
    )
  } else if (draft.kind === 'milestone') {
    const isNative = draft.token.toLowerCase() === ZERO_ADDRESS
    const symbol = isNative
      ? 'ETH'
      : (tokenMeta[tokenKey(draft.token)]?.symbol ?? 'tokens')
    if (!isNative) {
      lines.push(
        `- (Auto-prepended: \`approve()\` to the EscrowBundler for the total amount.)`
      )
    }
    const total = draft.milestones
      .map((m) => Number(m.amount))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0)
    lines.push(
      `- Deploy a SmartInvoice escrow to \`${draft.recipient}\` · client \`${draft.client}\``
    )
    lines.push(
      `- Total: \`${total} ${symbol}\` across ${draft.milestones.length} milestones`
    )
    lines.push(`- Safety valve: \`${draft.safetyValveDate}\``)
    for (let i = 0; i < draft.milestones.length; i++) {
      const m = draft.milestones[i]
      lines.push(
        `  - Milestone ${i + 1}: ${m.title || '(untitled)'} — \`${m.amount} ${symbol}\` by ${m.endDate}`
      )
    }
  } else if (draft.kind === 'airdrop') {
    const isNative = draft.token.toLowerCase() === ZERO_ADDRESS
    const symbol = isNative
      ? 'ETH'
      : (tokenMeta[tokenKey(draft.token)]?.symbol ?? 'tokens')
    if (!isNative) {
      lines.push(
        `- (Auto-prepended: \`approve()\` to the Disperse contract for the total amount.)`
      )
    }
    const total = draft.recipients
      .map((r) => Number(r.amount))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0)
    lines.push(
      `- Bulk-send \`${total} ${symbol}\` to **${draft.recipients.length} recipients** via Disperse`
    )
    for (const r of draft.recipients.slice(0, 5)) {
      lines.push(`  - \`${r.recipient}\` — \`${r.amount} ${symbol}\``)
    }
    if (draft.recipients.length > 5) {
      lines.push(`  - …and ${draft.recipients.length - 5} more`)
    }
  } else {
    // custom + custom-like
    const d = draft as Extract<
      TxDraft,
      { target: string; valueEth: string; calldata: string }
    >
    lines.push(`- Call \`${d.target}\` with \`${d.valueEth || '0'} ETH\``)
    if (d.calldata && d.calldata !== '0x') {
      const preview =
        d.calldata.length > 24
          ? `${d.calldata.slice(0, 12)}…${d.calldata.slice(-8)}`
          : d.calldata
      lines.push(`- Calldata: \`${preview}\``)
    }
  }

  return lines.join('\n')
}

/**
 * Render a "Decoded transactions" markdown section for all drafts.
 * Designed to be appended to the proposal description body for voter
 * comprehension.
 */
export function summarizeDraftsMarkdown(
  drafts: TxDraft[],
  tokenMeta: TokenMetaMap
): string {
  if (drafts.length === 0) return ''
  return [
    '---',
    '## Decoded transactions',
    '',
    ...drafts.map((d, i) => summarizeDraftMarkdown(d, i, tokenMeta)),
  ].join('\n\n')
}

/** Collect the unique ERC-20 token addresses referenced across drafts. */
export function uniqueErc20Tokens(drafts: TxDraft[]): `0x${string}`[] {
  const seen = new Set<string>()
  const out: `0x${string}`[] = []
  for (const d of drafts) {
    const addr =
      d.kind === 'erc20'
        ? d.token
        : d.kind === 'stream'
          ? d.token
          : d.kind === 'milestone'
            ? d.token
            : d.kind === 'airdrop'
              ? d.token
              : null
    if (!addr || !isAddress(addr)) continue
    if (addr.toLowerCase() === ZERO_ADDRESS) continue
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
