/**
 * Decode raw proposal transactions ({ target, valueWei, calldata }) into a
 * tagged union so the detail page can render typed cards instead of a flat
 * "function name + args" list. Mirrors the Gnars wizard's tx-type taxonomy
 * (send-eth / send-usdc / send-tokens / send-nfts / droposal / custom) so the
 * read-side visuals match the write-side wizard.
 *
 * Note on subgraph encoding: Builder's subgraph stores calldatas WITH selector
 * (unlike Nouns protocol, which strips them). We don't need selector-less
 * reconstruction here.
 */
import {
  type Address,
  decodeFunctionData,
  formatEther,
  formatUnits,
  type Hex,
  isAddress,
  isHex,
} from 'viem'

import { BASE_COMMON_TOKENS, ETHEREUM_COMMON_TOKENS } from '@/lib/treasury-tokens'

// Selectors we look at when classifying a tx.
const SEL_ERC20_TRANSFER = '0xa9059cbb' as const // transfer(address,uint256)
const SEL_ERC721_TRANSFER_FROM = '0x23b872dd' as const // transferFrom(address,address,uint256)
const SEL_ERC721_SAFE_TRANSFER_FROM = '0x42842e0e' as const // safeTransferFrom(address,address,uint256)
const SEL_ERC721_SAFE_TRANSFER_FROM_DATA = '0xb88d4fde' as const // safeTransferFrom(address,address,uint256,bytes)
const SEL_DROPOSAL_CREATE_EDITION = '0x36e2cd62' as const // createEdition(...) — Zora ZoraNFTCreatorV1

// Per-chain Zora droposal proxy. Add more chains if/when we support them.
const DROPOSAL_TARGET: Record<number, Address> = {
  8453: '0x58c3ccb2dcb9384e5ab9111cd1a5dea916b0f33c', // Base
}

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const ERC721_TRANSFER_FROM_ABI = [
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const ERC721_SAFE_TRANSFER_FROM_ABI = [
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const ERC721_SAFE_TRANSFER_FROM_DATA_ABI = [
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

const DROPOSAL_CREATE_EDITION_ABI = [
  {
    type: 'function',
    name: 'createEdition',
    stateMutability: 'nonpayable',
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
  },
] as const

// Lookup of (chain, address) → decimals/symbol for the small set of stables
// we want to special-case (USDC label, formatted amounts).
type TokenInfo = { symbol: string; decimals: number }
const TOKEN_INFO_BY_ADDR: Record<string, TokenInfo> = {}
for (const t of [...BASE_COMMON_TOKENS, ...ETHEREUM_COMMON_TOKENS]) {
  TOKEN_INFO_BY_ADDR[t.address.toLowerCase()] = { symbol: t.symbol, decimals: t.decimals }
}
function lookupToken(addr: string): TokenInfo | null {
  return TOKEN_INFO_BY_ADDR[addr.toLowerCase()] ?? null
}

function normalizeHex(data: string | undefined | null): Hex | null {
  if (!data) return null
  if (data === '0x') return '0x'
  const prefixed = data.startsWith('0x') ? data : `0x${data}`
  return isHex(prefixed) ? (prefixed as Hex) : null
}

function selectorOf(calldata: Hex | null): string | null {
  if (!calldata || calldata.length < 10) return null
  return calldata.slice(0, 10).toLowerCase()
}

export type DecodedProposalTx =
  | {
      type: 'send-eth'
      target: string
      valueWei: bigint
      valueEth: string
      calldata: Hex
    }
  | {
      type: 'send-usdc'
      target: string
      valueWei: bigint
      calldata: Hex
      tokenSymbol: string
      tokenDecimals: number
      recipient: Address | null
      amount: bigint | null
      amountFormatted: string
    }
  | {
      type: 'send-tokens'
      target: string
      valueWei: bigint
      calldata: Hex
      tokenSymbol: string | null
      tokenDecimals: number | null
      recipient: Address | null
      amount: bigint | null
      amountFormatted: string | null
    }
  | {
      type: 'send-nfts'
      target: string
      valueWei: bigint
      calldata: Hex
      from: Address | null
      to: Address | null
      tokenId: bigint | null
      safe: boolean
    }
  | {
      type: 'droposal'
      target: string
      valueWei: bigint
      calldata: Hex
      name: string
      symbol: string
      editionSize: string
      royaltyBps: number
      fundsRecipient: Address
      defaultAdmin: Address
      pricePerMintEth: string
      saleStartUnix: number
      saleEndUnix: number
      collectionDescription: string
      animationURI: string
      imageURI: string
    }
  | {
      type: 'custom'
      target: string
      valueWei: bigint
      valueEth: string
      calldata: Hex
      reason: 'no-calldata-but-value' | 'unknown-selector' | 'decode-failed'
    }

export type RawProposalTx = {
  target: string
  calldata: string
  valueWei: bigint
}

export function decodeProposalTx(raw: RawProposalTx, chainId: number): DecodedProposalTx {
  const calldata = normalizeHex(raw.calldata) ?? '0x'
  const valueWei = raw.valueWei
  const isEthOnly = calldata === '0x'

  // Send ETH (no calldata, just value)
  if (isEthOnly) {
    if (valueWei > BigInt(0)) {
      return {
        type: 'send-eth',
        target: raw.target,
        valueWei,
        valueEth: formatEther(valueWei),
        calldata,
      }
    }
    return {
      type: 'custom',
      target: raw.target,
      valueWei,
      valueEth: formatEther(valueWei),
      calldata,
      reason: 'no-calldata-but-value',
    }
  }

  // Droposal — target matches the per-chain Zora proxy
  const droposalAddr = DROPOSAL_TARGET[chainId]
  if (
    droposalAddr &&
    raw.target.toLowerCase() === droposalAddr.toLowerCase() &&
    selectorOf(calldata) === SEL_DROPOSAL_CREATE_EDITION
  ) {
    try {
      const { args } = decodeFunctionData({
        abi: DROPOSAL_CREATE_EDITION_ABI,
        data: calldata,
      })
      const [
        name,
        symbol,
        editionSize,
        royaltyBps,
        fundsRecipient,
        defaultAdmin,
        saleConfig,
        collectionDescription,
        animationURI,
        imageURI,
      ] = args
      return {
        type: 'droposal',
        target: raw.target,
        valueWei,
        calldata,
        name,
        symbol,
        editionSize: editionSize.toString(),
        royaltyBps,
        fundsRecipient,
        defaultAdmin,
        pricePerMintEth: formatEther(saleConfig.publicSalePrice),
        saleStartUnix: Number(saleConfig.publicSaleStart),
        saleEndUnix: Number(saleConfig.publicSaleEnd),
        collectionDescription,
        animationURI,
        imageURI,
      }
    } catch {
      return customFallback(raw, calldata, valueWei, 'decode-failed')
    }
  }

  const sel = selectorOf(calldata)

  // ERC-20 transfer
  if (sel === SEL_ERC20_TRANSFER) {
    try {
      const { args } = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: calldata })
      const [to, amount] = args as [Address, bigint]
      const known = lookupToken(raw.target)
      if (known?.symbol === 'USDC') {
        return {
          type: 'send-usdc',
          target: raw.target,
          valueWei,
          calldata,
          tokenSymbol: known.symbol,
          tokenDecimals: known.decimals,
          recipient: isAddress(to) ? to : null,
          amount,
          amountFormatted: formatUnits(amount, known.decimals),
        }
      }
      return {
        type: 'send-tokens',
        target: raw.target,
        valueWei,
        calldata,
        tokenSymbol: known?.symbol ?? null,
        tokenDecimals: known?.decimals ?? null,
        recipient: isAddress(to) ? to : null,
        amount,
        amountFormatted: known ? formatUnits(amount, known.decimals) : null,
      }
    } catch {
      return customFallback(raw, calldata, valueWei, 'decode-failed')
    }
  }

  // ERC-721 transfer family
  if (
    sel === SEL_ERC721_TRANSFER_FROM ||
    sel === SEL_ERC721_SAFE_TRANSFER_FROM ||
    sel === SEL_ERC721_SAFE_TRANSFER_FROM_DATA
  ) {
    try {
      const abi =
        sel === SEL_ERC721_TRANSFER_FROM
          ? ERC721_TRANSFER_FROM_ABI
          : sel === SEL_ERC721_SAFE_TRANSFER_FROM
            ? ERC721_SAFE_TRANSFER_FROM_ABI
            : ERC721_SAFE_TRANSFER_FROM_DATA_ABI
      const { args } = decodeFunctionData({ abi, data: calldata })
      const [from, to, tokenId] = args as unknown as [Address, Address, bigint]
      return {
        type: 'send-nfts',
        target: raw.target,
        valueWei,
        calldata,
        from: isAddress(from) ? from : null,
        to: isAddress(to) ? to : null,
        tokenId,
        safe: sel !== SEL_ERC721_TRANSFER_FROM,
      }
    } catch {
      return customFallback(raw, calldata, valueWei, 'decode-failed')
    }
  }

  return customFallback(raw, calldata, valueWei, 'unknown-selector')
}

function customFallback(
  raw: RawProposalTx,
  calldata: Hex,
  valueWei: bigint,
  reason: 'no-calldata-but-value' | 'unknown-selector' | 'decode-failed'
): DecodedProposalTx {
  return {
    type: 'custom',
    target: raw.target,
    valueWei,
    valueEth: formatEther(valueWei),
    calldata,
    reason,
  }
}

export type ProposalTxKind = DecodedProposalTx['type']

export const PROPOSAL_TX_LABELS: Record<ProposalTxKind, string> = {
  'send-eth': 'Send ETH',
  'send-usdc': 'Send USDC',
  'send-tokens': 'Send tokens',
  'send-nfts': 'Send NFT',
  droposal: 'Create droposal',
  custom: 'Custom call',
}
