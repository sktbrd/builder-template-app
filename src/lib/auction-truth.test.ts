import { describe, expect, it } from 'vitest'

import {
  type BidEcho,
  type MergeableBid,
  mergeBidEchoes,
  parseTokenImage,
} from './auction-truth'

const bid = (over: Partial<MergeableBid> = {}): MergeableBid => ({
  id: '0xserver',
  amountEth: '0.500000000000000000',
  bidder: '0xAbC0000000000000000000000000000000000001',
  bidderShort: '0xAbC0…0001',
  comment: null,
  ...over,
})

const echo = (over: Partial<BidEcho> = {}): BidEcho => ({
  txHash: '0xtx1',
  tokenId: 7,
  bidder: '0xAbC0000000000000000000000000000000000001',
  amountEth: '0.5',
  comment: 'gm',
  ts: 1000,
  ...over,
})

describe('mergeBidEchoes', () => {
  it('returns the server list untouched when there are no echoes', () => {
    const bids = [bid()]
    expect(mergeBidEchoes(bids, [])).toBe(bids)
  })

  it('backfills the comment onto a matching server bid and does not duplicate it', () => {
    // "0.5" (typed) vs "0.500000000000000000" (formatEther) is the SAME bid.
    const merged = mergeBidEchoes(
      [bid({ comment: null })],
      [echo({ comment: 'gm frens' })]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('0xserver')
    expect(merged[0].comment).toBe('gm frens')
  })

  it('matches case-insensitively on the bidder address', () => {
    const merged = mergeBidEchoes(
      [bid({ bidder: '0xabc0000000000000000000000000000000000001' })],
      [echo({ bidder: '0xABC0000000000000000000000000000000000001' })]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].comment).toBe('gm')
  })

  it('does not clobber an existing server comment', () => {
    const merged = mergeBidEchoes([bid({ comment: 'real onchain note' })], [echo()])
    expect(merged[0].comment).toBe('real onchain note')
  })

  it('prepends an unmatched echo as a synthetic newest-first bid', () => {
    const merged = mergeBidEchoes(
      [bid({ amountEth: '0.4' })],
      [echo({ amountEth: '0.9' })]
    )
    expect(merged).toHaveLength(2)
    expect(merged[0].id).toBe('echo:0xtx1')
    expect(merged[0].amountEth).toBe('0.9')
    expect(merged[0].comment).toBe('gm')
    expect(merged[0].bidderShort).toBe('0xAbC0…0001')
    expect(merged[1].id).toBe('0xserver')
  })
})

describe('parseTokenImage', () => {
  it('extracts image from a base64 data URI (the Builder renderer shape)', () => {
    const payload = JSON.stringify({
      name: 'Token #9',
      image: 'https://nouns.build/art/9.webp',
    })
    const uri = `data:application/json;base64,${Buffer.from(payload, 'utf8').toString('base64')}`
    expect(parseTokenImage(uri)).toBe('https://nouns.build/art/9.webp')
  })

  it('extracts image from a utf8 data URI', () => {
    const uri = `data:application/json,${encodeURIComponent(JSON.stringify({ image: 'ipfs://Qm123' }))}`
    expect(parseTokenImage(uri)).toBe('ipfs://Qm123')
  })

  it('extracts image from a raw JSON string', () => {
    expect(parseTokenImage('{"image":"ipfs://raw"}')).toBe('ipfs://raw')
  })

  it('returns null for an https metadata URL (needs a fetch — out of scope)', () => {
    expect(parseTokenImage('https://example.com/metadata/9')).toBeNull()
  })

  it('returns null for malformed/empty/missing-image payloads', () => {
    expect(parseTokenImage(null)).toBeNull()
    expect(parseTokenImage(undefined)).toBeNull()
    expect(parseTokenImage('data:application/json;base64,not-base64-json!!')).toBeNull()
    expect(parseTokenImage('{"name":"no image here"}')).toBeNull()
  })
})
