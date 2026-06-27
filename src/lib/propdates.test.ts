import { describe, expect, it } from 'vitest'

import { decodePropdateContent, PropdateMessageType } from '@/lib/propdates'

describe('decodePropdateContent', () => {
  it('passes INLINE_TEXT through unchanged', () => {
    expect(
      decodePropdateContent(PropdateMessageType.INLINE_TEXT, 'Shipped milestone 1.')
    ).toBe('Shipped milestone 1.')
  })

  it('extracts .content from an INLINE_JSON message', () => {
    const message = JSON.stringify({
      content: 'Shipped **milestone 1**.',
      labels: ['build'],
    })
    expect(decodePropdateContent(PropdateMessageType.INLINE_JSON, message)).toBe(
      'Shipped **milestone 1**.'
    )
  })

  it('falls back to the raw string when INLINE_JSON is malformed', () => {
    const broken = '{"content": "oops'
    expect(decodePropdateContent(PropdateMessageType.INLINE_JSON, broken)).toBe(broken)
  })

  it('falls back to the raw string when INLINE_JSON lacks a string content field', () => {
    const noContent = JSON.stringify({ labels: ['build'] })
    expect(decodePropdateContent(PropdateMessageType.INLINE_JSON, noContent)).toBe(
      noContent
    )
  })

  it('passes URL types through without fetching', () => {
    const url = 'https://example.com/propdate.json'
    expect(decodePropdateContent(PropdateMessageType.URL_JSON, url)).toBe(url)
    expect(decodePropdateContent(PropdateMessageType.URL_TEXT, url)).toBe(url)
  })

  it('returns an empty string for an empty message', () => {
    expect(decodePropdateContent(PropdateMessageType.INLINE_JSON, '')).toBe('')
  })
})
