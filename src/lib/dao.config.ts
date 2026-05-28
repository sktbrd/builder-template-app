import type { AddressType, CHAIN_ID } from '@buildeross/types'

import { DAO_CONFIG as ONCHAIN_CONFIG } from '@/config/dao'
// `dao.theme.json` is the visible identity of this fork — tagline, accent,
// radius, display font. Edit by hand for one-off tweaks, or use
// `pnpm switch-dao <preset>` for the full DAO-swap workflow.
import THEME_OVERRIDES from '@/config/dao.theme.json'

import { BASE_COMMON_TOKENS, type TreasuryToken } from './treasury-tokens'

/**
 * The single config surface a forking DAO touches.
 *
 * Identity / chainId / addresses are auto-resolved from the on-chain DAO
 * (via `pnpm fetch-dao` → `src/config/dao.ts`). You override them here only
 * if you want to display something different than what's on-chain.
 *
 * Theme / features / socials are hand-edited per fork.
 */
export type DaoTheme = {
  /** Primary brand color — drives accent surfaces (CTAs, active nav, vote bars). */
  accent: string
  /** Base radius in px. Cards/inputs/buttons derive from this. 0 = sharp, 20 = pillowy. */
  radius: number
  /** Body font family name — must be loaded in app/layout.tsx. */
  font: string
  /** Display font for hero headings. Defaults to body font. */
  displayFont: string
  /** Initial color mode for visitors — `system` respects OS preference. */
  defaultMode: 'light' | 'dark' | 'system'
}

export type DaoFeatures = {
  /** Show the auction-history chart tab on /auction. */
  auctionChart: boolean
  /** Show the analytics charts on /treasury. */
  treasuryAnalytics: boolean
  /** Expose /members in the nav. */
  membersDirectory: boolean
  /** 140-char on-chain comment field on the bid form. */
  bidComments: boolean
  /** Surface "voting closes in / auction ending" banners. */
  timeBasedAlerts: boolean
  /** Expose /coins (Clanker direct-deploy + list + detail). Auto-hidden on
   * chains that don't support Clanker — leave true for the default Base setup. */
  coins: boolean
}

export type DaoSocials = Partial<{
  twitter: string
  farcaster: string
  discord: string
  github: string
  website: string
}>

export type DaoConfig = {
  name: string
  tagline: string
  image: string
  chainId: CHAIN_ID
  addresses: {
    token: AddressType
    auction: AddressType
    governor: AddressType
    treasury: AddressType
    metadata: AddressType
    escrowDelegate?: AddressType
  }
  theme: DaoTheme
  features: DaoFeatures
  socials: DaoSocials
  /** ERC-20 contracts to surface on /treasury. See lib/treasury-tokens.ts. */
  treasuryTokens: TreasuryToken[]
  /**
   * Extra ERC-721 collections the treasury holds (besides the DAO token).
   * Shown as quick-pick pills in the "Send NFT" proposal form.
   */
  treasuryNftCollections: TreasuryNftCollection[]
  /**
   * Per-fork overrides for protocol contracts used by proposal forms.
   * Lets a DAO point at custom deployments on niche chains without forking
   * the template's address tables.
   */
  contractOverrides?: ContractOverrides
}

export type ContractOverrides = {
  /** Disperse.app contract — bulk send (Airdrop Tokens form). */
  disperse?: `0x${string}`
  /** EscrowBundler — milestone payments form. */
  escrowBundler?: `0x${string}`
  /** Sablier LockupLinear — token streams form. */
  sablierLockupLinear?: `0x${string}`
  /** Zora NFT Creator factory — droposal form. */
  zoraNftCreator?: `0x${string}`
  /** EAS contract — pin asset + nominate delegate forms. */
  eas?: `0x${string}`
}

export type TreasuryNftCollection = {
  symbol: string
  address: `0x${string}`
}

const T = THEME_OVERRIDES as Partial<{
  tagline: string
  accent: string
  radius: number
  font: string
  displayFont: string
  defaultMode: DaoTheme['defaultMode']
}>

export const daoConfig: DaoConfig = {
  // ── Identity ──────────────────────────────────────
  // `name` and `image` come from the on-chain config. Override here if you want
  // to display something different than what's stored on-chain.
  name: ONCHAIN_CONFIG.name,
  tagline: T.tagline ?? 'Powering Onchain Communities.',
  image: ONCHAIN_CONFIG.image,

  // ── Onchain ──────────────────────────────────────
  // Auto-resolved by `pnpm fetch-dao`. Don't edit manually.
  chainId: ONCHAIN_CONFIG.chain.id,
  addresses: {
    token: ONCHAIN_CONFIG.addresses.token,
    auction: ONCHAIN_CONFIG.addresses.auction,
    governor: ONCHAIN_CONFIG.addresses.governor,
    treasury: ONCHAIN_CONFIG.addresses.treasury,
    metadata: ONCHAIN_CONFIG.addresses.metadata,
  },

  // ── Theme ────────────────────────────────────────
  // Driven by src/config/dao.theme.json. The Tweaks panel (dev only — gear
  // icon, bottom-right) lets you preview overrides live before committing.
  theme: {
    accent: T.accent ?? '#2563eb',
    radius: T.radius ?? 0,
    font: T.font ?? 'Geist',
    displayFont: T.displayFont ?? 'Geist',
    defaultMode: T.defaultMode ?? 'system',
  },

  // ── Optional features ────────────────────────────
  // Flip off anything you don't need. The template's components respect these
  // flags (e.g. BidForm hides its comment field when bidComments === false).
  features: {
    auctionChart: true,
    treasuryAnalytics: true,
    membersDirectory: true,
    bidComments: true,
    timeBasedAlerts: true,
    coins: true,
  },

  // ── Socials ──────────────────────────────────────
  // Surfaces in the footer (and OG metadata, eventually).
  socials: {
    // twitter: '@yourdao',
    // farcaster: 'yourdao',
    // discord: 'https://discord.gg/...',
    // github: 'https://github.com/yourdao',
    // website: 'https://yourdao.com',
  },

  // ── Treasury tokens ──────────────────────────────
  // ERC-20 tokens shown on /treasury. Default to common Base stables; forks
  // on other chains should swap for ETHEREUM_COMMON_TOKENS or list manually.
  treasuryTokens: ONCHAIN_CONFIG.chain.id === 8453 ? BASE_COMMON_TOKENS : [],

  // ── Treasury NFT collections ─────────────────────
  // External ERC-721 collections held by the treasury — surfaced as
  // quick-pick pills in the "Send NFT" proposal form. The DAO governance
  // token is always available implicitly.
  treasuryNftCollections: [
    // { symbol: 'BasePaint', address: '0xBa…' },
  ],

  // ── Contract overrides ───────────────────────────
  // Optional per-fork overrides for protocol contracts used by proposal
  // forms. Leave empty to use the built-in chain → address mappings.
  // contractOverrides: {
  //   disperse: '0x…',           // Airdrop Tokens
  //   escrowBundler: '0x…',      // Milestone Payments
  //   sablierLockupLinear: '0x…', // Stream Tokens
  //   zoraNftCreator: '0x…',     // Droposal: Single Edition
  //   eas: '0x…',                // Pin Treasury Asset + Nominate Delegate
  // },
}

/**
 * Three-color palette used by `<AuctionArt>` as a placeholder when an auction
 * has no on-chain image. Derived from the fork's accent so it stays on-brand
 * without per-fork hand-tuning. Real auction art always wins when present.
 */
export function fallbackArtPalette(): [string, string, string] {
  return [daoConfig.theme.accent, '#ffffff', '#0b0b0c']
}
