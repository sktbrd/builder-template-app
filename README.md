# Builder Community Site Template

A forkable, fully-themed Next.js template for any [Builder DAO](https://nouns.build).
Drop in your token contract address, run one command, deploy. You get a polished
community site with light + dark themes, real on-chain governance UI (vote / bid /
propose), treasury analytics, member directory, and Open Graph share images — out
of the box.

## What you get

| Page | Route | What's on it |
|---|---|---|
| Dashboard | `/` | Hero, live auction spotlight, real activity feed (recent bids + proposals), recent proposals card grid, treasury KPI snapshot |
| Auction | `/auction/[id]` | Real artwork, live bid form (real `createBid`), bid history, voting-power gating, settle button when an auction has ended |
| Proposals | `/proposals` | Filterable card grid against real subgraph data, embedded vote bars + status badges |
| Proposal | `/proposals/[id]` | Markdown description, decoded transaction list, sticky vote panel with real `castVoteWithReason` and live voting-power resolution |
| Create | `/proposals/new` | Eligibility-gated proposal create flow with markdown editor + preview, transaction builder, real `propose(...)` |
| Treasury | `/treasury` | Real ETH balance, ERC-20 holdings via multicall, NFT grid (DAO-owned tokens), allocation donut + recent transfer history |
| Members | `/members` | Real holder list with ENS resolution (top 20, gated on Alchemy), CSV export |
| About | `/about` | Real on-chain founders, smart-contract list with copy-to-clipboard |

Plus:

- **Light + dark** themes via `next-themes`, theme tokens as CSS variables, accent + radius + display font driven by `dao.theme.json`
- **`pnpm switch-dao <preset|0xtoken>`** — flip the local labrat to any Builder DAO in one command (Builder, Gnars, or any token address). Tested on Kendama (`0xd7d4…f5ff`)
- **Real on-chain writes** for vote casting, bid placement, proposal creation, and auction settlement — all via wagmi + `@buildeross/sdk` ABIs
- **Tweaks panel** in dev — preview theme overrides live without restarting
- **Open Graph images** — Satori-rendered 1200×630 PNGs for `/`, `/proposals/[id]`, `/auction/[id]`, all theme-aware

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 + Typography plugin · `wagmi` + RainbowKit · `next-themes` · `react-markdown` (gfm + breaks + sanitize) · `@buildeross/sdk` for the Builder subgraph + ABIs · TypeScript everywhere.

---

## Quick start

### 1. Install

```bash
pnpm install
```

### 2. Environment

```bash
cp sample.env .env.local
```

Edit `.env.local`:

| Var | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_NETWORK_TYPE` | yes | `"mainnet"` or `"testnet"` |
| `NEXT_PUBLIC_CHAIN_ID` | yes | `1` (Ethereum) · `8453` (Base) · `10` (Optimism) · `7777777` (Zora) |
| `NEXT_PUBLIC_DAO_TOKEN_ADDRESS` | yes | Your DAO's token contract |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | yes | Free at [cloud.reown.com](https://cloud.reown.com) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | recommended | Faster RPC + enables ENS resolution on `/members` |
| `PINATA_API_KEY` | media uploads | [Pinata](https://pinata.cloud) scoped-key JWT — required for `/coins` (coin media + metadata) and future proposal/propdate attachments |
| `NEXT_PUBLIC_PINATA_GATEWAY` | optional | Public gateway hostname override (e.g. `your-gateway.mypinata.cloud`) |
| `NEXT_PUBLIC_SITE_URL` | optional | Deployed URL (no trailing slash) so `sitemap.xml` / `robots.txt` resolve correctly |

### 3. Resolve your DAO's on-chain config

```bash
pnpm fetch-dao
```

Reads `NEXT_PUBLIC_DAO_TOKEN_ADDRESS` + `NEXT_PUBLIC_CHAIN_ID`, queries the chain, writes `src/config/dao.{ts,json}`, generates `public/icon.png` from your DAO's contract image.

### 4. Run

```bash
pnpm dev
```

Open <http://localhost:3000>.

---

## Switching DAOs (the labrat)

The `switch-dao` CLI flips your local environment to a different Builder DAO without hand-editing `.env.local`. Useful for testing the template against multiple real DAOs before deploying your own.

```bash
# Built-in presets (fast — point at known addresses + theme)
pnpm switch-dao builder              # Builder DAO on Base
pnpm switch-dao gnars                # Gnars DAO on Base

# Any token address (defaults theme; tweak with flags)
pnpm switch-dao 0xd7d40e5afceabc923b70dd299206155fb330f5ff \
  --tagline "A nounish DAO for kendama players" \
  --accent "#dc2626" \
  --display-font "Geist" \
  --radius 12

# See all flags
pnpm switch-dao --help
```

Under the hood: rewrites `.env.local`, merges theme overrides into `src/config/dao.theme.json`, and re-runs `pnpm fetch-dao`. Restart `pnpm dev` to pick up the new DAO.

---

## Fork checklist

A re-skinned, deployed site for your DAO in under 20 minutes:

- [ ] **Fork or clone** this repo into your DAO's GitHub org
- [ ] `pnpm install`
- [ ] **Set the 4 required env vars** in `.env.local` — chain id, token address, WalletConnect project id, and (recommended) an Alchemy key
- [ ] `pnpm fetch-dao` — resolves your contract addresses + favicon
- [ ] **Edit `src/config/dao.theme.json`** with your DAO's tagline + accent + radius + display font (or use `pnpm switch-dao 0x<token> --tagline "…" --accent "#…"`)
- [ ] **Edit the About copy** in `src/app/about/page.tsx` — mission paragraphs are placeholder text. Founders, contracts, and treasury numbers all flow from on-chain.
- [ ] **Configure treasury tokens** in `src/lib/dao.config.ts` if you want ERC-20 holdings on `/treasury` — spread `BASE_COMMON_TOKENS` from `src/lib/treasury-tokens.ts` or list custom contracts
- [ ] **Toggle features** in `daoConfig.features` (e.g. set `bidComments: false` to hide the on-chain bid comment field)
- [ ] **Test in dev** — open the Tweaks panel (gear icon, bottom-right) to preview light/dark + accent live before committing
- [ ] **Deploy to Vercel** — see [Deploy](#deploy-to-vercel) below
- [ ] **Update `socials`** in `daoConfig.socials` (twitter, farcaster, discord, github, website) — surfaces in the footer

The Tweaks panel is dev-only (gated on `NODE_ENV !== 'production'`); production renders exactly what's in `dao.config.ts` + `dao.theme.json`.

---

## Theming & config surface

Two committed files drive every fork's identity:

- `src/lib/dao.config.ts` — schema, defaults, feature flags
- `src/config/dao.theme.json` — visible identity (tagline, accent, radius, display font)

```ts
// src/lib/dao.config.ts

import { BASE_COMMON_TOKENS } from '@/lib/treasury-tokens'

export const daoConfig: DaoConfig = {
  // Identity (name + image come from on-chain via fetch-dao)
  name: ONCHAIN_CONFIG.name,
  tagline: T.tagline ?? 'Powering Onchain Communities.',
  image: ONCHAIN_CONFIG.image,

  // Chain + addresses (auto-resolved by fetch-dao)
  chainId: ONCHAIN_CONFIG.chain.id,
  addresses: { token, auction, governor, treasury, metadata },

  // Theme — driven by dao.theme.json
  theme: {
    accent: T.accent ?? '#2563eb',
    radius: T.radius ?? 12,
    font: T.font ?? 'Geist',
    displayFont: T.displayFont ?? 'Geist',
    defaultMode: T.defaultMode ?? 'system',
  },

  // Optional feature flags
  features: {
    bidComments: true,
    coins: true,
  },

  // ERC-20 contracts shown on /treasury (opt-in)
  treasuryTokens:
    ONCHAIN_CONFIG.chain.id === 8453 ? BASE_COMMON_TOKENS : [],

  socials: { /* twitter, farcaster, discord, github, website */ },
}
```

Theme **values** live in `src/app/globals.css` under `:root` and `[data-theme='dark']`. The Tailwind v4 `@theme` block exposes them as utility classes (`bg-accent`, `text-muted-fg`, `border-border-strong`, etc.) — don't hardcode hex colors anywhere in components.

---

## Deploy to Vercel

### One-click

1. Push your fork to GitHub
2. Import on [vercel.com/new](https://vercel.com/new)
3. Add the same env vars from `.env.local` to the Vercel project
4. Deploy — Vercel runs `pnpm build` which pre-runs `pnpm fetch-dao`

### Manual

```bash
pnpm build && pnpm start
```

### Custom domain

Set up the domain in Vercel, point your DNS at it, done.

---

## Available scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (port 3000) |
| `pnpm fetch-dao` | Resolves on-chain DAO config + writes `src/config/dao.ts` |
| `pnpm switch-dao <preset\|0x…>` | Switch the labrat to any Builder DAO |
| `pnpm build` | Production build (auto-runs `fetch-dao` first) |
| `pnpm start` | Production server |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm lint` | type-check + ESLint with `--fix` |

---

## Project structure

```
scripts/
├── fetchDaoAddresses.ts  # `pnpm fetch-dao`
└── switchDao.ts          # `pnpm switch-dao` labrat CLI
src/
├── app/                  # App Router pages + API + OG images
│   ├── api/              # Pinata · feed · treasury · img-proxy route handlers
│   ├── auction/[id]/     # + opengraph-image.tsx + latest/ redirect route
│   ├── proposals/        # list · [id]/ detail · new/ create
│   ├── treasury/
│   ├── members/
│   ├── about/
│   ├── globals.css       # Tailwind v4 @theme + CSS-var theme tokens
│   ├── layout.tsx        # Root layout, fonts, theme injection
│   ├── opengraph-image.tsx
│   ├── web3-providers.tsx # wagmi, RainbowKit, react-query, next-themes
│   └── page.tsx          # Dashboard
├── components/
│   ├── ui/               # shadcn-style atoms (Button)
│   ├── dao/              # DAO-specific composites (VoteBar, BidForm,
│   │                       VotePanel, ProposalCreateForm, …)
│   ├── DaoAvatar.tsx     # Real DAO image (IPFS) with stripes fallback
│   ├── DaoLogo.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Markdown.tsx      # react-markdown wrapper (gfm + sanitize)
│   └── TweaksPanel.tsx   # Dev-only theme tweak floater
├── lib/
│   ├── dao.config.ts     # 👈 the config surface every fork edits
│   ├── dao-data.ts       # All server-side subgraph + chain reads
│   ├── presets.ts        # Builder/Gnars/Verdant — shared with switch-dao
│   ├── treasury-tokens.ts # Opt-in ERC-20 defaults per chain
│   ├── og-utils.ts       # Shared OG_SIZE, theme colors
│   ├── types.ts          # ProposalStatus etc.
│   └── utils.ts          # cn()
└── config/               # Auto-generated by fetch-dao + per-fork theme
    ├── dao.ts            # ⚠️ Auto-generated, do not edit
    ├── dao.json          # Auto-generated companion
    ├── dao.theme.json    # 👈 Per-fork tagline + theme overrides
    └── types.ts
```

---

## License

MIT — see [license.md](./license.md).
