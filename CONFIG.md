# Configuring a fork

Everything you need to point this template at *your* Builder DAO lives in
two places:

1. **`src/lib/dao.config.ts`** — UI, theme, treasury tokens, feature flags,
   per-fork contract overrides.
2. **`.env.local`** — secrets, API keys, environment-specific URLs.

The on-chain addresses (`token`, `auction`, `governor`, `treasury`,
`metadata`) are populated automatically by `pnpm fetch-dao`. Don't edit
them by hand.

---

## `dao.config.ts` walkthrough

### Identity

```ts
name: ONCHAIN_CONFIG.name,           // pulled from the DAO token contract
tagline: 'Powering Onchain Communities.',
image: ONCHAIN_CONFIG.image,         // pulled from the on-chain image
```

Override `name`/`image` if you want the UI to show something different
from what's stored on-chain.

### Theme

```ts
theme: {
  accent: '#2563eb',                 // primary brand color
  radius: 12,                        // px, applied to most rounded corners
  font: 'Geist',
  displayFont: 'Geist',
  defaultMode: 'system',             // 'light' | 'dark' | 'system'
}
```

The dev Tweaks panel (gear icon, bottom-right in dev mode) lets you
preview changes live before committing them to `src/config/dao.theme.json`.

### Features

Flip any of these off if you don't want the corresponding routes/UI:

```ts
features: {
  auctionChart: true,        // /auction/[id]?view=chart tab
  treasuryAnalytics: true,   // donut chart + revenue breakdown on /treasury
  membersDirectory: true,    // /members and per-member pages
  bidComments: true,         // optional comment field on BidForm
  timeBasedAlerts: true,     // "Auction ends in N hours" banner
  coins: true,               // /coins and creator coin proposals
}
```

### Treasury tokens

ERC-20 contracts surfaced on `/treasury` *and* as quick-picks in the
"Send ERC-20" / "Stream Tokens" / "Milestone Payments" / "Airdrop Tokens"
proposal forms.

```ts
import { BASE_COMMON_TOKENS } from './treasury-tokens'

treasuryTokens: [
  ...BASE_COMMON_TOKENS,                          // USDC, WETH, DAI on Base
  { symbol: 'SENDIT', address: '0xBa5B…', decimals: 18 },
]
```

For Ethereum mainnet swap `BASE_COMMON_TOKENS` for `ETHEREUM_COMMON_TOKENS`,
or list addresses by hand.

### Treasury NFT collections (new)

ERC-721 collections held by the treasury besides the DAO governance token.
These appear as quick-pick pills in the "Send NFT" proposal form.

```ts
treasuryNftCollections: [
  { symbol: 'BasePaint', address: '0xBa5e…' },
]
```

The DAO governance token is always available implicitly — you don't need
to list it.

### Contract overrides (new)

Per-fork overrides for the protocol contracts used by proposal forms.
Leave the field unset to use the template's built-in chain → address
mappings. Useful when:

- You're on a niche chain not in our mapping
- You need to point at a custom deployment

```ts
contractOverrides: {
  disperse: '0xDeadBeef…',               // Airdrop Tokens
  escrowBundler: '0xDeadBeef…',          // Milestone Payments
  sablierLockupLinear: '0xDeadBeef…',    // Stream Tokens (also fills the
                                         //   "Sablier LockupLinear contract"
                                         //   field when starting a new stream)
  zoraNftCreator: '0xDeadBeef…',         // Droposal: Single Edition (prefilled)
  eas: '0xDeadBeef…',                    // Pin Treasury Asset + Nominate Delegate
}
```

If a form's underlying contract isn't supported on the current chain *and*
no override is provided, the form shows a warning banner and disables
submission.

### Socials

```ts
socials: {
  twitter: '@yourdao',
  farcaster: 'yourdao',
  discord: 'https://discord.gg/…',
  github: 'https://github.com/yourdao',
  website: 'https://yourdao.com',
}
```

Surfaces in the footer and OG metadata.

---

## Environment variables

Put these in `.env.local` (not committed to git).

### Required for production

| Variable | What it does | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Pairs the WalletConnect modal for wallet connect/disconnect. Required in production builds; dev builds warn but still run. | https://cloud.walletconnect.com |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used by the sitemap, OG metadata, and robots.txt. Falls back to `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `localhost:3000`. | The domain you ship under |

### Optional integrations

| Variable | What it enables | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Treasury transfer history feed on `/treasury`. Without it, the recent-transfers card hides itself. | https://dashboard.alchemy.com |
| `PINATA_API_KEY` | Server-side IPFS pin operations (used by the milestone metadata upload, droposal cover uploads, etc.). | https://app.pinata.cloud |

### Auto-populated by Vercel

`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, `VERCEL_ENV` — used as
fallbacks if `NEXT_PUBLIC_SITE_URL` isn't set.

---

## Per-feature feature gating

Some proposal kinds depend on a contract that may not be deployed on the
chain your DAO lives on. The forms gracefully disable themselves with a
warning banner in those cases. Capability mapping:

| Kind | Requires | Supported chains (default) |
|---|---|---|
| `pin_asset` | EAS contract | Mainnet, Optimism, Base (+ testnets) |
| `delegate` (escrow) | EAS contract | Same as above |
| `milestone` | EscrowBundler | Mainnet, Optimism, Base, Zora (+ testnets) |
| `airdrop` | Disperse contract | Mainnet, Optimism, Polygon, Arbitrum, Base |
| `stream` | Sablier LL address (user-entered or via override) | All — chain-specific address required |
| `droposal` | Zora NFT Creator (user-entered or via override) | All — chain-specific address required |

To enable any of these on a chain we don't ship support for, set
`daoConfig.contractOverrides.<feature>` to the address of a compatible
deployment.

---

## Switching between DAOs

The repo supports multiple DAO configs via `pnpm switch-dao` and
`pnpm fetch-dao`. The token address lives in `src/config/dao.config.json`
and the script refreshes the cached on-chain values into
`src/config/dao.onchain.json` and `src/config/dao.theme.json`.

```bash
pnpm switch-dao 0xDaoTokenAddress base
pnpm fetch-dao
pnpm dev
```
