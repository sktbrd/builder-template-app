import { describe, expect, it } from 'vitest'

import {
  availableProposalTabs,
  parseProposalTab,
  PROPOSAL_TAB_KEYS,
  PROPOSAL_TAB_LABELS,
} from './proposal-tabs'

describe('availableProposalTabs', () => {
  it('lists all four tabs in reading order when propdates are supported', () => {
    expect(availableProposalTabs({ propdatesSupported: true })).toEqual([
      'proposal',
      'transactions',
      'votes',
      'propdates',
    ])
  })

  it('drops the propdates tab on chains without EAS support', () => {
    expect(availableProposalTabs({ propdatesSupported: false })).toEqual([
      'proposal',
      'transactions',
      'votes',
    ])
  })
})

describe('parseProposalTab', () => {
  const all = availableProposalTabs({ propdatesSupported: true })
  const noPropdates = availableProposalTabs({ propdatesSupported: false })

  it('returns a valid tab unchanged', () => {
    expect(parseProposalTab('votes', all)).toBe('votes')
  })

  it('falls back to the first tab when the param is absent', () => {
    expect(parseProposalTab(null, all)).toBe('proposal')
    expect(parseProposalTab(undefined, all)).toBe('proposal')
    expect(parseProposalTab('', all)).toBe('proposal')
  })

  it('falls back to the first tab for an unknown value', () => {
    expect(parseProposalTab('bogus', all)).toBe('proposal')
  })

  it('normalises case and surrounding whitespace', () => {
    expect(parseProposalTab('VOTES', all)).toBe('votes')
    expect(parseProposalTab('  Propdates  ', all)).toBe('propdates')
  })

  it('rejects a tab that is valid but not currently available', () => {
    expect(parseProposalTab('propdates', noPropdates)).toBe('proposal')
  })

  it('falls back to the canonical first key when nothing is available', () => {
    expect(parseProposalTab('votes', [])).toBe('proposal')
  })
})

describe('PROPOSAL_TAB_LABELS', () => {
  it('labels every tab key in English', () => {
    expect(PROPOSAL_TAB_KEYS.map((k) => PROPOSAL_TAB_LABELS[k])).toEqual([
      'Proposal',
      'Transactions',
      'Votes',
      'Propdates',
    ])
  })
})
