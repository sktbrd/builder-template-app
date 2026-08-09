/**
 * Single source of truth for the DAO presets shown in:
 *
 *  - Tweaks panel (dev only — preset cycling for visual preview)
 *  - `pnpm switch-dao <preset>` CLI (labrat workflow)
 *
 * A preset is "switchable" if it carries a `tokenAddress` — meaning we know a
 * real Builder DAO behind it. Theme-only presets (no `tokenAddress`) are still
 * useful for the Tweaks panel as a what-if visual.
 */

export type DaoPresetTheme = {
  accent: string
  radius: number
  displayFont: string
}

export type DaoPreset = {
  /** Stable key — passed to `pnpm switch-dao <key>`. */
  key: string
  /** Human-readable label. */
  label: string
  tagline: string
  theme: DaoPresetTheme
  /** When set, the preset can be switched to via the labrat CLI. */
  chain?: {
    id: number
    networkType: 'mainnet' | 'testnet'
  }
  tokenAddress?: string
}

export const PRESETS: Record<string, DaoPreset> = {
  builder: {
    key: 'builder',
    label: 'Builder DAO',
    tagline: 'Powering Onchain Communities.',
    theme: { accent: '#2563eb', radius: 12, displayFont: 'Geist' },
    chain: { id: 8453, networkType: 'mainnet' },
    tokenAddress: '0xe8af882f2f5c79580230710ac0e2344070099432',
  },
  gnars: {
    key: 'gnars',
    label: 'Gnars DAO',
    tagline: 'Nounish Open Source Action Sports Brand experiment.',
    theme: { accent: '#f5d447', radius: 8, displayFont: 'Londrina Solid' },
    chain: { id: 8453, networkType: 'mainnet' },
    tokenAddress: '0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17',
  },
  // Theme-only preset — no live DAO; used by the Tweaks panel as a "green
  // commons" what-if. Not selectable from the switch-dao CLI.
  verdant: {
    key: 'verdant',
    label: 'Verdant',
    tagline: 'A regenerative onchain commons.',
    theme: { accent: '#16a34a', radius: 16, displayFont: 'Geist' },
  },
}

/** Presets that can be passed to `pnpm switch-dao` (have a real token). */
export const SWITCHABLE_PRESETS = Object.fromEntries(
  Object.entries(PRESETS).filter(([, p]) => !!p.tokenAddress)
) as Record<
  string,
  DaoPreset & { chain: NonNullable<DaoPreset['chain']>; tokenAddress: string }
>
