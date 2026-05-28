import { describe, expect, it } from 'vitest'

import { decodeBidComment, encodeCreateBidCalldata } from './bid-comment'

describe('bid-comment encode/decode', () => {
  it('roundtrips a basic ASCII comment', () => {
    const data = encodeCreateBidCalldata(BigInt(42), 'gm fren')
    expect(decodeBidComment(data)).toBe('gm fren')
  })

  it('roundtrips emoji + unicode', () => {
    const msg = 'gn 🌙 — nouns 4ever'
    const data = encodeCreateBidCalldata(BigInt(1), msg)
    expect(decodeBidComment(data)).toBe(msg)
  })

  it('returns plain createBid calldata when comment is empty', () => {
    const data = encodeCreateBidCalldata(BigInt(7), '')
    // 4-byte selector + 32-byte tokenId arg = 36 bytes = 74 hex chars w/ 0x.
    expect(data).toMatch(/^0x[0-9a-f]{72}$/)
    expect(decodeBidComment(data)).toBe(null)
  })

  it('treats whitespace-only comments as empty', () => {
    const data = encodeCreateBidCalldata(BigInt(7), '   \n\t  ')
    expect(data).toMatch(/^0x[0-9a-f]{72}$/)
    expect(decodeBidComment(data)).toBe(null)
  })

  it('decodes null on non-bid calldata', () => {
    expect(decodeBidComment(null)).toBe(null)
    expect(decodeBidComment(undefined)).toBe(null)
    expect(decodeBidComment('0x')).toBe(null)
    expect(decodeBidComment('0xdeadbeef')).toBe(null)
  })

  it('preserves leading + trailing whitespace inside the comment, trims outer', () => {
    const data = encodeCreateBidCalldata(BigInt(1), '  hello world  ')
    // encodeCreateBidCalldata trims for storage, so output should be the trimmed text
    expect(decodeBidComment(data)).toBe('hello world')
  })
})
