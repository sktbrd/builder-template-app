import { auctionAbi } from '@buildeross/sdk/contract'
import { concatHex, encodeFunctionData, type Hex, hexToString, toHex } from 'viem'

/**
 * Standard `createBid(uint256 tokenId)` calldata = 4-byte function selector
 * + 32-byte tokenId arg = 36 bytes = 74 hex chars including the `0x` prefix.
 *
 * Any bytes appended after that are UTF-8-encoded comment bytes. The EVM
 * silently ignores the trailing data when decoding the function call, but
 * they're permanently retained in the transaction input on-chain — so we
 * can read them back later via `eth_getTransactionByHash` and decode.
 *
 * This is the calldata-trailing-bytes pattern popularized by gnars.com:
 * one tx for both bid + comment, no separate Comments contract needed.
 */
const CREATE_BID_CALLDATA_PREFIX_LEN = 74

/**
 * Builds the raw calldata for `createBid(tokenId)` with `comment` packed
 * after the function args. Returns the plain calldata when the trimmed
 * comment is empty so we don't pay calldata gas for whitespace.
 */
export function encodeCreateBidCalldata(tokenId: bigint, comment: string): Hex {
  const base = encodeFunctionData({
    abi: auctionAbi,
    functionName: 'createBid',
    args: [tokenId],
  })
  const trimmed = comment.trim()
  if (!trimmed) return base
  const commentBytes = toHex(new TextEncoder().encode(trimmed))
  return concatHex([base, commentBytes])
}

/**
 * Reverses `encodeCreateBidCalldata` — strips the 74-char header from a
 * transaction's input data and decodes the trailing bytes as UTF-8.
 * Returns null when there are no trailing bytes or when decoding fails.
 */
export function decodeBidComment(input: Hex | string | null | undefined): string | null {
  if (!input) return null
  const str = String(input)
  if (str.length <= CREATE_BID_CALLDATA_PREFIX_LEN) return null
  const trailing = ('0x' + str.slice(CREATE_BID_CALLDATA_PREFIX_LEN)) as Hex
  try {
    const decoded = hexToString(trailing)
    // Strip trailing NUL bytes — some wallets pad calldata to 32-byte
    // alignment, which would otherwise render as garbage.
    const NUL = String.fromCharCode(0)
    let end = decoded.length
    while (end > 0 && decoded.charCodeAt(end - 1) === 0) end -= 1
    const cleaned = decoded.slice(0, end).split(NUL).join('').trim()
    return cleaned.length > 0 ? cleaned : null
  } catch {
    return null
  }
}
