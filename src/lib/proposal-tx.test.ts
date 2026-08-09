/**
 * Encoder snapshot tests for proposal-tx.ts.
 *
 * The goal is *not* to lock down byte-for-byte calldata across DAOs (the
 * encoding depends on the current DAO's chain + addresses), but to verify:
 *   1. Each kind encodes to a syntactically valid (target, valueEth, calldata) tuple
 *   2. The function selector at the start of calldata matches the expected ABI
 *   3. Validation rejects obvious mistakes
 *   4. Helper functions (buildApprovalDraft, uniqueErc20Tokens, etc.) behave sanely
 *
 * Run with `pnpm test`.
 */
import { describe, expect, it } from 'vitest'

import { daoConfig } from './dao.config'
import {
  buildApprovalDraft,
  emptyDraft,
  encodeDraft,
  encodeDraftToTxs,
  isAirdropSupported,
  isEasSupported,
  isEscrowSupported,
  type TokenMetaMap,
  type TxDraft,
  uniqueErc20Tokens,
  validateDraft,
  ZERO_ADDRESS,
} from './proposal-tx'

// All sample addresses use lowercase to bypass viem's strict checksum check —
// the encoders run them through getAddress() to normalize anyway.
const SAMPLE = {
  treasury: daoConfig.addresses.treasury.toLowerCase(),
  token: daoConfig.addresses.token.toLowerCase(),
  auction: daoConfig.addresses.auction.toLowerCase(),
  recipient: '0x000000000000000000000000000000000000dead',
  other: '0x1111111111111111111111111111111111111111',
  usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  sablierLL: '0xfcf737582d167c7d20a336532eb8bcca8cf8e350',
  zoraCreator: '0x58c3ccb2dcb9384e5ab9111cd1a5dea916b0f33c',
}

const CTX = {
  treasury: SAMPLE.treasury,
  token: SAMPLE.token,
  auction: SAMPLE.auction,
}

const TOKEN_META: TokenMetaMap = {
  [SAMPLE.usdc.toLowerCase()]: { decimals: 6, symbol: 'USDC' },
}

// ── Selectors ──────────────────────────────────────────────────────────────

const SEL = {
  // ERC-20
  transfer: '0xa9059cbb',
  approve: '0x095ea7b3',
  // ERC-721
  safeTransferFrom: '0x42842e0e',
  // DAO token
  mintTo: '0x755edd17',
  // Auction
  pause: '0x8456cb59',
  unpause: '0x3f4ba83a',
  // EAS attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))
  attest: '0xf17325e7',
  // EscrowBundler.deployEscrow(address,uint256[],bytes,bytes32,uint256)
  deployEscrow: '0xecccfad8',
  // Sablier LL createWithDurationsLL((address,address,uint128,address,bool,bool,(uint40,uint40),(address,uint256)))
  createWithDurationsLL: '0x2a3cb4a6',
  // Zora createEdition(string,string,uint64,uint16,address,address,(...),string,string,string)
  createEdition: '0x3857fb13',
  // Disperse.app
  disperseEther: '0xe63d38ed',
  disperseToken: '0xc73a2d60',
}

// Helper: assert the first 10 chars (function selector) match
function expectSelector(calldata: string, expected: string) {
  expect(calldata.slice(0, 10).toLowerCase()).toBe(expected.toLowerCase())
}

// ── Empty draft fixtures ───────────────────────────────────────────────────

describe('emptyDraft', () => {
  it('returns a draft for every documented kind', () => {
    const kinds = [
      'eth',
      'erc20',
      'nft',
      'custom',
      'stream',
      'airdrop',
      'milestone',
      'mint_gov',
      'delegate',
      'pause_auction',
      'walletconnect',
      'pin_asset',
      'droposal',
      'add_artwork',
      'replace_artwork',
    ] as const

    for (const kind of kinds) {
      const draft = emptyDraft(kind)
      expect(draft.kind).toBe(kind)
    }
  })

  it('prefills sablierLockupLinear override into stream drafts', () => {
    // No override configured by default — should be empty
    const draft = emptyDraft('stream')
    if (draft.kind === 'stream') {
      expect(draft.sablierLL).toBe(daoConfig.contractOverrides?.sablierLockupLinear ?? '')
    }
  })

  it('defaults airdrop token to native ETH sentinel', () => {
    const draft = emptyDraft('airdrop')
    if (draft.kind === 'airdrop') {
      expect(draft.token).toBe(ZERO_ADDRESS)
      expect(draft.recipients.length).toBe(1)
    }
  })
})

// ── Encoding ───────────────────────────────────────────────────────────────

describe('encodeDraft — eth', () => {
  it('encodes a plain ETH transfer with no calldata', () => {
    const draft: TxDraft = {
      kind: 'eth',
      recipient: SAMPLE.recipient,
      valueEth: '0.5',
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expect(tx!.calldata).toBe('0x')
    expect(tx!.valueEth).toBe('0.5')
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.recipient.toLowerCase())
  })
})

describe('encodeDraft — erc20', () => {
  it('encodes a token.transfer call', () => {
    const draft: TxDraft = {
      kind: 'erc20',
      token: SAMPLE.usdc,
      recipient: SAMPLE.recipient,
      amount: '100',
    }
    const tx = encodeDraft(draft, TOKEN_META, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.transfer)
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.usdc.toLowerCase())
    expect(tx!.valueEth).toBe('0')
  })

  it('returns null when token decimals are unknown', () => {
    const draft: TxDraft = {
      kind: 'erc20',
      token: SAMPLE.other,
      recipient: SAMPLE.recipient,
      amount: '100',
    }
    expect(encodeDraft(draft, {}, CTX)).toBeNull()
  })
})

describe('encodeDraft — nft', () => {
  it('encodes safeTransferFrom from the treasury', () => {
    const draft: TxDraft = {
      kind: 'nft',
      contract: SAMPLE.token,
      tokenId: '42',
      recipient: SAMPLE.recipient,
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.safeTransferFrom)
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.token.toLowerCase())
  })
})

describe('encodeDraft — mint_gov', () => {
  it('encodes mintTo on the DAO token contract', () => {
    const draft: TxDraft = { kind: 'mint_gov', recipient: SAMPLE.recipient }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.mintTo)
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.token.toLowerCase())
  })
})

describe('encodeDraft — delegate (escrow via EAS)', () => {
  it('encodes an EAS attest call when EAS is supported', () => {
    if (!isEasSupported()) return // chain doesn't support EAS — skip
    const draft: TxDraft = { kind: 'delegate', delegatee: SAMPLE.recipient }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.attest)
  })
})

describe('encodeDraft — pause_auction', () => {
  it('encodes pause()', () => {
    const draft: TxDraft = { kind: 'pause_auction', action: 'pause' }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.pause)
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.auction.toLowerCase())
  })

  it('encodes unpause()', () => {
    const draft: TxDraft = { kind: 'pause_auction', action: 'unpause' }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.unpause)
  })
})

describe('encodeDraft — pin_asset (EAS)', () => {
  it('encodes an EAS attest for ERC-721 collection', () => {
    if (!isEasSupported()) return
    const draft: TxDraft = {
      kind: 'pin_asset',
      tokenType: 'erc721',
      contract: SAMPLE.other,
      isCollection: true,
      tokenId: '',
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.attest)
  })

  it('returns null for invalid contract address', () => {
    const draft: TxDraft = {
      kind: 'pin_asset',
      tokenType: 'erc721',
      contract: 'not-an-address',
      isCollection: true,
      tokenId: '',
    }
    expect(encodeDraft(draft, {}, CTX)).toBeNull()
  })
})

describe('encodeDraft — milestone', () => {
  it('encodes deployEscrow when escrow supported', () => {
    if (!isEscrowSupported()) return
    const draft: TxDraft = {
      kind: 'milestone',
      token: SAMPLE.usdc,
      recipient: SAMPLE.recipient,
      client: SAMPLE.other,
      safetyValveDate: '2099-01-01',
      milestones: [
        { amount: '100', title: 'M1', description: '', endDate: '2098-12-01' },
        { amount: '200', title: 'M2', description: '', endDate: '2098-12-15' },
      ],
    }
    const tx = encodeDraft(draft, TOKEN_META, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.deployEscrow)
    expect(tx!.valueEth).toBe('0')
  })

  it('uses native ETH amount when token is zero address', () => {
    if (!isEscrowSupported()) return
    const draft: TxDraft = {
      kind: 'milestone',
      token: ZERO_ADDRESS,
      recipient: SAMPLE.recipient,
      client: SAMPLE.other,
      safetyValveDate: '2099-01-01',
      milestones: [{ amount: '1', title: 'M1', description: '', endDate: '2098-12-01' }],
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expect(tx!.valueEth).toBe('1')
  })
})

describe('encodeDraft — airdrop', () => {
  it('encodes disperseEther for native ETH', () => {
    if (!isAirdropSupported()) return
    const draft: TxDraft = {
      kind: 'airdrop',
      token: ZERO_ADDRESS,
      recipients: [
        { recipient: SAMPLE.recipient, amount: '0.1' },
        { recipient: SAMPLE.other, amount: '0.2' },
      ],
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.disperseEther)
    // total = 0.3 ETH
    expect(Number(tx!.valueEth)).toBeCloseTo(0.3)
  })

  it('encodes disperseToken for ERC-20 with zero value', () => {
    if (!isAirdropSupported()) return
    const draft: TxDraft = {
      kind: 'airdrop',
      token: SAMPLE.usdc,
      recipients: [{ recipient: SAMPLE.recipient, amount: '100' }],
    }
    const tx = encodeDraft(draft, TOKEN_META, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.disperseToken)
    expect(tx!.valueEth).toBe('0')
  })
})

describe('encodeDraft — stream', () => {
  it('encodes Sablier createWithDurationsLL', () => {
    const draft: TxDraft = {
      kind: 'stream',
      sablierLL: SAMPLE.sablierLL,
      token: SAMPLE.usdc,
      recipient: SAMPLE.recipient,
      totalAmount: '1000',
      durationDays: '365',
      cliffDays: '30',
      cancelable: true,
    }
    const tx = encodeDraft(draft, TOKEN_META, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.createWithDurationsLL)
    expect(tx!.target.toLowerCase()).toBe(SAMPLE.sablierLL.toLowerCase())
  })
})

describe('encodeDraft — droposal', () => {
  it('encodes Zora createEdition', () => {
    const draft: TxDraft = {
      kind: 'droposal',
      name: 'My Edition',
      symbol: 'ME',
      description: 'desc',
      imageUri: 'ipfs://x',
      priceEth: '0.01',
      editionSize: '100',
      saleStart: '',
      saleEnd: '',
      mintLimitPerAddress: '',
      royaltyPercent: '5',
      fundsRecipient: SAMPLE.treasury,
      defaultAdmin: '',
    }
    const tx = encodeDraft(draft, {}, CTX)
    expect(tx).not.toBeNull()
    expectSelector(tx!.calldata, SEL.createEdition)
  })
})

// ── Helpers ────────────────────────────────────────────────────────────────

describe('encodeDraftToTxs (auto-included approvals)', () => {
  it('returns a single tx for plain ETH transfers', () => {
    const draft: TxDraft = { kind: 'eth', recipient: SAMPLE.recipient, valueEth: '1' }
    const txs = encodeDraftToTxs(draft, {}, CTX)
    expect(txs).not.toBeNull()
    expect(txs!.length).toBe(1)
  })

  it('prepends an ERC-20 approve() before stream deployment', () => {
    const draft: TxDraft = {
      kind: 'stream',
      sablierLL: SAMPLE.sablierLL,
      token: SAMPLE.usdc,
      recipient: SAMPLE.recipient,
      totalAmount: '1000',
      durationDays: '365',
      cliffDays: '0',
      cancelable: true,
    }
    const txs = encodeDraftToTxs(draft, TOKEN_META, CTX)
    expect(txs).not.toBeNull()
    expect(txs!.length).toBe(2)
    // First is the approval
    expectSelector(txs![0].calldata, SEL.approve)
    expect(txs![0].target.toLowerCase()).toBe(SAMPLE.usdc.toLowerCase())
    // Second is the actual stream call
    expectSelector(txs![1].calldata, SEL.createWithDurationsLL)
  })

  it('skips approval for native-ETH airdrops', () => {
    if (!isAirdropSupported()) return
    const draft: TxDraft = {
      kind: 'airdrop',
      token: ZERO_ADDRESS,
      recipients: [{ recipient: SAMPLE.recipient, amount: '0.1' }],
    }
    const txs = encodeDraftToTxs(draft, {}, CTX)
    expect(txs).not.toBeNull()
    expect(txs!.length).toBe(1)
  })

  it('returns null when underlying encodeDraft fails', () => {
    const draft: TxDraft = {
      kind: 'erc20',
      token: SAMPLE.other,
      recipient: SAMPLE.recipient,
      amount: '1',
    } // no token meta → encodeDraft returns null
    expect(encodeDraftToTxs(draft, {}, CTX)).toBeNull()
  })
})

describe('buildApprovalDraft', () => {
  it('returns a custom approve() draft for ERC-20 streams', () => {
    const stream: TxDraft = {
      kind: 'stream',
      sablierLL: SAMPLE.sablierLL,
      token: SAMPLE.usdc,
      recipient: SAMPLE.recipient,
      totalAmount: '1000',
      durationDays: '365',
      cliffDays: '0',
      cancelable: true,
    }
    const approval = buildApprovalDraft(stream, TOKEN_META)
    expect(approval).not.toBeNull()
    expect(approval!.kind).toBe('custom')
    expectSelector(approval!.calldata, SEL.approve)
    expect(approval!.target.toLowerCase()).toBe(SAMPLE.usdc.toLowerCase())
  })

  it('returns null for native ETH airdrops (no approval needed)', () => {
    const airdrop: TxDraft = {
      kind: 'airdrop',
      token: ZERO_ADDRESS,
      recipients: [{ recipient: SAMPLE.recipient, amount: '0.1' }],
    }
    expect(buildApprovalDraft(airdrop, {})).toBeNull()
  })

  it('returns null for ETH transfers', () => {
    const draft: TxDraft = { kind: 'eth', recipient: SAMPLE.recipient, valueEth: '1' }
    expect(buildApprovalDraft(draft, {})).toBeNull()
  })

  it('sums multi-entry airdrop approvals as bigint, not float (regression)', () => {
    if (!isAirdropSupported()) return
    // 0.7 + 0.1 is the canonical float trap: in IEEE-754 it evaluates to
    // 0.7999999999999999, so the old float-sum-then-reparse path produced an
    // approval of 799999999999999900 (18 decimals) — short of the 8e17 that
    // disperseToken actually pulls, making execute() revert after the timelock.
    // The approval must equal the exact sum of the per-entry parseUnits amounts.
    const meta: TokenMetaMap = {
      [SAMPLE.usdc.toLowerCase()]: { decimals: 18, symbol: 'TKN18' },
    }
    const airdrop: TxDraft = {
      kind: 'airdrop',
      token: SAMPLE.usdc,
      recipients: [
        { recipient: SAMPLE.recipient, amount: '0.7' },
        { recipient: SAMPLE.other, amount: '0.1' },
      ],
    }
    const approval = buildApprovalDraft(airdrop, meta)
    expect(approval).not.toBeNull()
    expectSelector(approval!.calldata, SEL.approve)
    const approved = BigInt(`0x${approval!.calldata.slice(-64)}`)
    // BigInt(string), not numeric/`n` literals: the values exceed
    // Number.MAX_SAFE_INTEGER, and the tsconfig target predates BigInt literals.
    expect(approved).toBe(BigInt('800000000000000000'))
    expect(approved).toBeGreaterThan(BigInt('799999999999999900'))
  })
})

describe('uniqueErc20Tokens', () => {
  it('collects token addresses across erc20/stream/milestone/airdrop drafts', () => {
    const drafts: TxDraft[] = [
      { kind: 'erc20', token: SAMPLE.usdc, recipient: SAMPLE.recipient, amount: '1' },
      { kind: 'eth', recipient: SAMPLE.recipient, valueEth: '1' },
      {
        kind: 'airdrop',
        token: SAMPLE.usdc, // duplicate — should dedupe
        recipients: [{ recipient: SAMPLE.recipient, amount: '1' }],
      },
      {
        kind: 'airdrop',
        token: ZERO_ADDRESS, // native — should be skipped
        recipients: [{ recipient: SAMPLE.recipient, amount: '1' }],
      },
    ]
    const tokens = uniqueErc20Tokens(drafts)
    expect(tokens.length).toBe(1)
    expect(tokens[0].toLowerCase()).toBe(SAMPLE.usdc.toLowerCase())
  })
})

// ── Validation ─────────────────────────────────────────────────────────────

describe('validateDraft', () => {
  it('rejects an ETH transfer with no recipient', () => {
    const errs = validateDraft({ kind: 'eth', recipient: '', valueEth: '1' }, {})
    expect(errs.length).toBeGreaterThan(0)
  })

  it('rejects a milestone where client == recipient', () => {
    const errs = validateDraft(
      {
        kind: 'milestone',
        token: SAMPLE.usdc,
        recipient: SAMPLE.recipient,
        client: SAMPLE.recipient, // same!
        safetyValveDate: '2099-01-01',
        milestones: [
          { amount: '1', title: 'M1', description: '', endDate: '2098-01-01' },
        ],
      },
      TOKEN_META
    )
    expect(errs.some((e) => /client and recipient must be different/i.test(e))).toBe(true)
  })

  it('rejects an airdrop with duplicate recipients', () => {
    const errs = validateDraft(
      {
        kind: 'airdrop',
        token: ZERO_ADDRESS,
        recipients: [
          { recipient: SAMPLE.recipient, amount: '0.1' },
          { recipient: SAMPLE.recipient, amount: '0.2' }, // dup
        ],
      },
      {}
    )
    expect(errs.some((e) => /duplicate/i.test(e))).toBe(true)
  })

  it('rejects a milestone where safety valve is too close to the last milestone', () => {
    const errs = validateDraft(
      {
        kind: 'milestone',
        token: SAMPLE.usdc,
        recipient: SAMPLE.recipient,
        client: SAMPLE.other,
        safetyValveDate: '2099-01-15', // < 30 days after the milestone
        milestones: [
          {
            amount: '1',
            title: 'M1',
            description: '',
            endDate: '2099-01-01',
          },
        ],
      },
      TOKEN_META
    )
    expect(errs.some((e) => /30 days/i.test(e))).toBe(true)
  })
})
