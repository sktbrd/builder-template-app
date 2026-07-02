# Tester feedback — NB demo site (2026-07-03)

Actionable breakdown of external tester feedback on the deployed demo site, mapped
to concrete code changes.

- **Source:** Notion "2026-07-03 Testing NB Demo Site" (criticus / benedictvs), 14 comments.
- **Code line references** below are relative to branch **`upstream-m1-prep`** (PR
  [#2](https://github.com/BuilderOSS/builder-template-app/pull/2)), which is what the demo
  runs — check out that branch to follow the `file:line` pointers.
- Status: triaged, not yet implemented. This doc is the tracking artifact.

## TL;DR

- **14 comments, mostly small.** 5 are XS (copy / CSS / one-liner), 5 are S, 3 are M,
  plus 1 inferred NFT item.
- **The two "contrast too low" comments share one root cause.** `--accent-strong` is
  derived once (darkened toward black) as an inline style on `<html>`
  (`layout.tsx:81`) and never rebinds for dark mode, so on dark surfaces it renders
  dark-blue-on-near-black (~2.4:1). One token fix clears the Vote pill, the network
  pill, and every dark-mode `hover:text-accent-strong` link.
- **"Member tokens redirect to boilerplate" is not an external redirect.** Tiles link
  internally to `/auction/[id]`; the boilerplate look is the degraded fallback for
  tokens older than the last 50 auctions. ⚠️ Also confirm the demo deploy is built
  from current `main`.
- **Biggest items:** creator-coin "add to queue" (M), Review-step enrichment (M),
  treasury asset discovery (S+).

## Priority table

| #  | Comment | Area | Effort | Risk | Type |
|----|---------|------|--------|------|------|
| 1  | Truncate long feed titles (`…` / clickable) | Feed | XS | low | fix |
| 3  | Network pill contrast | Header | XS | low | fix |
| 5  | Vote-pill contrast (dark cards) | Feed | S | med | fix\* |
| 7  | Distinct default pfps per member | Avatars | XS | low | fix |
| 8  | Tooltip for Active/Dormant | Members | XS | low | fix |
| 14 | Inconsistent tile size + stray ring | Hero strip | S | low | fix |
| 2  | Stats below banner get lost — move up | Hero | S | low | fix |
| 4  | Limit propdate post length in feed | Feed | S | low | fix |
| 6  | Whole feed card clickable | Feed | S | med | feature |
| 10 | Treasury misses Zora coin / other ERC-20s | Treasury | S | low | feature |
| 9  | Member token → boilerplate page + avatar inconsistency | Members | S | med | fix |
| 11 | ENS handles when sending funds | Wizard | S | low | feature |
| 12 | Creator coin → add to queue, reconcile prefill | Wizard | M | med | feature/decision |
| 13 | Review step omits useful info | Wizard | M | low | feature |

\* #3 and #5 collapse into one root-cause token fix (see Group A).

---

## Group A — Quick wins (batch now: XS/S, styling + copy)

- [ ] **#1 Truncate feed titles** — `HomeFeed.tsx` `ProposalLink` (`:190-199`) /
  `AuctionLink` (`:179-188`) render full titles inside a `flex flex-wrap` row → 2-line
  wrap. Wrap the title in `<span className="inline-block max-w-[26ch] truncate align-bottom">`
  + `title={title}` on the Link. The full title already lives on the linked page. **[XS]**
- [ ] **#3 + #5 Contrast (network pill + Vote pill) — one root-cause fix.**
  `--accent-strong` = `color-mix(… 80%, black)` set inline on `<html>` (`layout.tsx:81`,
  re-set by `tweaks-context.tsx:72-75`), never rebound for dark → ~2.4:1 dark-on-dark.
  Fix: emit `--accent` only inline, and derive `--accent-strong` in CSS —
  `:root { --accent-strong: color-mix(in oklab, var(--accent) 80%, black) }` and
  `[data-theme='dark'] { --accent-strong: color-mix(in oklab, var(--accent) 70%, white) }`
  (`globals.css`). Delete inline derivations at `layout.tsx:81` + `tweaks-context.tsx:72-75`.
  Optionally bump chip `bg-accent/15 ring-accent/40` (`primitives.tsx:82`) and give the
  network pill a `border border-accent/30` (`Header.tsx:290`). **[S, med]** — touches all
  ~78 `text-accent-strong` usages (desirable — same bug family), but visually re-check
  hero/auction. Validate the mix % against non-default fork accents.
- [ ] **#7 Distinct pfps** — `WalletPill` fallback uses a local flat-hue hash
  (`WalletPill.tsx:167-170`, only hue varies → green-band collisions). The gradient util
  is already in-repo and used by the feed (`bgForAddress` from `@buildeross/utils`, see
  `feed/Avatar.tsx:24`). Replace `avatarColor()` with `bgForAddress(address, ensAvatar ?? null)`
  at `WalletPill.tsx:69`. Fixes Founders + members table + delegation lists at once. **[XS]**
- [ ] **#8 Active/Dormant tooltip** — `ActiveBadge.tsx:12-28` has no title/aria. Add
  `title` + `aria-label` keyed on the boolean ("Voted in at least one of the last 5
  proposals" / "No votes in the last 5 proposals"), matching the house native-`title`
  pattern. **[XS]** _(mobile/touch → shadcn Tooltip later if repeated.)_
- [ ] **#14 Auction strip tiles** — `AuctionHistoryStrip.tsx`: (a) height variance from
  `text-[10px]` footers with no line-height + mono vs proportional fonts → add `h-full`
  to the button (`:158`) and explicit `leading-*` on `#id` (`:190`) and StatusLine spans;
  (b) stray ring clipped by `overflow-hidden` marquee → add `ring-inset` (`:143/:148`) or
  `py-1` to the marquee wrapper (`:75`); (c) align View-all tile to `w-[90px]` (`:56`);
  (d) drop `hover:border-border-strong` on highlighted tiles (`:158`). **[S]** _(the live
  ring appears twice because the marquee clones the list — note `:77`.)_
- [ ] **#2 Move stats up** — `HomeMetaStrip` renders after the token strip because
  `DashboardHero` emits both hero + strip as a fragment (`DashboardHero.tsx:147-156`).
  Add a `metaSlot?: ReactNode` prop rendered between `<AuctionHero>` and
  `<AuctionHistoryStrip>`; pass `<HomeMetaStrip/>` from `page.tsx` and delete the
  standalone render (`page.tsx:32-38`). Optionally box it as a KPI row (`py-2 border-b`). **[S]**
- [ ] **#4 Limit propdate length in feed** — `PropdateBody` (`FeedView.tsx:417-431`)
  renders full `<Markdown>` unbounded. Add `relative max-h-48 overflow-hidden` + bottom
  fade + "Read full update →" Link to `/proposals/${proposalNumber}` (pass
  `proposalNumber` at `:338`). Recommend fade + link over literal `overflow-y-auto`
  (nested scroll trap in an infinite feed). Same unbounded pattern in `QuoteBlock` (vote
  reasons) — optional clamp in the same pass. **[S]**

## Group B — Small features

- [ ] **#6 Whole card clickable** — the feed `Card` is a plain `<article>`
  (`FeedView.tsx:172`); only inner text links navigate. Use the stretched-link pattern:
  `relative` on the article + `<Link className="absolute inset-0" tabIndex={-1}>` +
  `relative z-10` on inner links. Pass hrefs per case (`/proposals/${n}`,
  `/auction/${id}`). Native cmd/middle-click opens a new tab (covers the "new tab" ask);
  a modal is over-scope. **[S, med]**
- [ ] **#10 Treasury asset discovery** — ERC-20 list is a hardcoded allowlist
  (`dao.config.ts:161` → `BASE_COMMON_TOKENS` = USDC/WETH/DAI only);
  `fetchTreasuryTokenHoldings` (`dao-data.ts:1255-1292`) multicalls `balanceOf` over only
  those. **Option B (recommended, S):** merge the DAO's own coins via
  `daoZoraCoinsRequest(...)` (already used in `CoinsListView.tsx:24`) into the multicall,
  read symbol/decimals. **Option A (M):** Alchemy `getTokenBalances` full discovery + spam
  filter behind the Alchemy key. **Secondary [XS]:** unpriced coins currently render
  "$0 / 0.0%" (`treasury/page.tsx:32-43,272-284`) — render "—" + "priced assets only" copy
  so listing them doesn't look worse. Ship #10 + secondary together. **[S]**
- [ ] **#11 ENS send** — recipient inputs validate `isAddress()` only
  (`DraftForm.tsx:178-187` etc.); wagmi config already includes mainnet
  (`clientConfig.ts:30-42`), only reverse-ENS exists today. Add a small `AddressInput`
  using `useEnsAddress({ name: normalize(v), chainId: mainnet.id })`; resolve `.eth` →
  store the 0x in the draft (no schema change). Drop into Eth/Erc20/Nft fields (the
  screenshotted flow); reused free by the others. **[S]**

## Group C — Needs a decision / larger

- [ ] **#9 Member token page + avatar consistency** — tiles link **internally**
  (`members/[address]/page.tsx:260`), so no external redirect. Two real bugs: (a)
  `/auction/[id]` only scans the last 50 auctions (`dao-data.ts:2153,2177`) → old tokens
  render the generic fallback ("boilerplate"); fix by fetching the Token entity by id for
  the name/image + `notFound()` when `!data.exists`. (b) Avatar inconsistency (the Loom):
  the profile header shows **no** avatar (`members/[address]/page.tsx:81-90`), the table
  shows the flat-hue pill, the feed shows gradient/ENS — unify via #7 + add `showAvatar`
  to the profile header. **⚠️ First confirm the deployed demo is on current `main`.**
  **[S, med]**
- [ ] **#12 Creator coin → queue, not immediate propose** — the Creator Coin card
  bypasses the wizard: `ProposalCreateForm.tsx:659` opens a modal that calls
  `governor.propose` directly (`CreatorCoinProposalModal.tsx:262-273`), skipping the tx
  queue, Details step, persistence, and Review. `buildCreatorCoinProposalTx` already
  returns `{target,value,calldata,suggestedTitle,suggestedDescription}` — the shape of a
  `custom` draft. Fix: add `onQueue(...)` to the modal → append a draft via `setDrafts` and
  merge prefill **non-destructively** into Details (only if empty). Keep direct-propose
  when `onQueue` absent (standalone `CoinCreateForm` still works). **Decision:** reuse plain
  `custom` draft (0 encoder change, opaque summary) vs new `creator_coin` TxKind (nicer
  summary, ~1 day). **[M, med]**
- [ ] **#13 Review step enrichment** — `Review.tsx` shows only
  title/description/summaries/decoded toggle. Add read-only wagmi batch reads: (1)
  governance params (votingDelay/votingPeriod/quorum + threshold/getVotes already read at
  `ProposalCreateForm.tsx:194-224`), labeled "current"; (2) treasury impact (totals already
  computed in `use-proposal-feasibility.ts:50-151` — surface as a positive "spends X of Y",
  not only warnings); (3) real encoded call count incl. auto-prepended `approve()`
  (`ProposalCreateForm.tsx:344-356`). No submit-path changes. **[M, low]**

## Suggested order (by file proximity)

1. **One CSS/token pass:** #3+#5 (`globals.css` / `layout.tsx` / `tweaks-context.tsx` /
   `primitives.tsx` / `Header.tsx`) + #7 (`WalletPill`) + #8 (`ActiveBadge`) + #14
   (`AuctionHistoryStrip`). All XS/S, mostly independent.
2. **Feed pass:** #1 (`HomeFeed`) + #4 + #6 (`FeedView`).
3. **Home layout:** #2 (`page.tsx` / `DashboardHero` / `HomeMetaStrip`).
4. **Data/features:** #10 (treasury) → #11 (ENS) → #9 (member/auction).
5. **Wizard (M, decision-gated):** #12 then #13.

## Open questions for the team

- **#12:** plain `custom` draft (fast) vs dedicated `creator_coin` TxKind (nicer)?
- **#10:** DAO-own coins via subgraph (ship now) vs full Alchemy discovery + spam filter
  (later)?
- **#9:** confirm the demo deploy is current `main` (the "redirect to boilerplate" can't be
  reproduced in code).
- **#5:** which fork accent is the demo using? The contrast mix % should be checked against
  it (repo ships blue `#2563eb`).
