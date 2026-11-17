# BUILD NOTES — token-radar-01 (Token Radar, radar-2 model)

Built 2026-11-17 by BU (agent of @topandina on make.fun) from the kit at
`kit/token-radar-01-kit/` (requirements + kit fetched live from make.fun; kit tarball
sha256 verified against `kit.json` on unpack). Nothing submitted — see "Still needed".

## What the competition actually is

The title says "token launch radar", but the kit defines the deliverable precisely:
the entry is a **program** (`main.ts`, Node 22, standard library only) that reads a
**sealed snapshot** (`input/snapshot.json`: 758 DefiLlama protocols at or above $5M
TVL, fetched 2026-11-14, 40 on the watchlist) and writes a ranked board
(`board.json`), a static dashboard (`dashboard/` + `data.js`), three screenshots,
and a dossier (`dossier.json`, built with the kit's vendored `makefun-board.ts`).
The judge is an AI judge that reads the dossier pairwise against other entries and
house reference dashboards. There is no live data feed in the graded artifact: the
"dynamic" part is that the program re-derives the whole board from whatever snapshot
it is given, so a future snapshot finds future launches early.

Prize: $1,325 USDC on Solana (1st $1,000, 2nd–5th $50, 6th–10th $25), escrow funded.
Entries close 2026-12-14T10:00:00Z. Entry fee: none.

## Architecture

```
token-radar-01/
├── main.ts                  Entry program (Node 22 stdlib, erasable TS, no build/install)
├── lib/model.ts             radar-2 model: eligibility, readiness, implied value, farm plans
├── vendor/makefun-board.ts  make.fun dossier library, byte-for-byte the kit's copy (sha256 verified)
├── dashboard/               Static page: index.html, app.css, app.js (no framework, no network)
├── screenshots/             1-board.jpg, 2-detail.jpg, 3-filtered.jpg (1440x900 JPEG, ~90KB each)
├── input/snapshot.json      Sealed snapshot copy for local runs (grader mounts its own at /input)
├── requirements.json        Full competition requirements (fetched live)
├── kit/                     Unpacked kit (reference only; not part of the submitted repo)
├── out/                     Generated output of the last local run (board.json, data.js, dashboard/, screenshots/, dossier.json)
├── README.md, LICENSE (MIT)
└── BUILD_NOTES.md           This file
```

Run: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json`
(needs Node 22.18+; built and verified on Node v24.22.1 here). Serve `out/` with any
static server to open the dashboard.

## The model (radar-2, lib/model.ts)

Eligibility — a protocol is ranked when it is pre-token (no mcap, no CoinGecko id, no
symbol recorded) and is NOT an exchange, a bridge, a versioned pool, a wrapped/staked
product, or an exchange-named product. Liquid staking/restaking protocols stay in:
they are protocols in their own right and do launch tokens. This matters: the naive
TVL ranking puts WBTC, Coinbase Bridge, USDT0 and Binance Bitcoin at ranks 1–4; the
field guide itself says a wrapped asset is not a protocol waiting on a launch, so the
model leaves them out. The starter's model does not do this.

Implied value — five factors, each 0..1, from the snapshot's own figures only:

- size: log-scaled TVL between $5M (0) and $200B (1)
- growth: 7-day change clamped to −40%..+150%, mapped 0..1
- age: sweet spot over age with no token (low under 30 days, full at 1–3 years, fading
  after; unknown age scores 0.5)
- category: stated prior table (Dexs/Lending 1.00, Derivatives 0.95, Risk Curators
  0.90, RWA 0.85, Oracles 0.75, …)
- chains: min(chains, 6) / 6

readiness = 0.30·size + 0.25·growth + 0.20·age + 0.15·category + 0.10·chains
alloc = 0.02 + 0.10·growth (modeled airdrop pool is 2–12% of TVL)
momentum = 1 + clamp(change_7d, −30%, +100%) / 100 · 0.5
implied = round(TVL · alloc · readiness · momentum)

No protocol name is special-cased anywhere. The dashboard recomputes each row with
the same arithmetic in-page and shows whether it matches the number board.json
carries (verified: it does, for the rows checked).

Farm plans — seven steps per protocol, derived from category/chains/TVL/age: fresh
wallet, the category's primary action with a TVL-tiered capital ($50/$100/$150/$250),
a second-feature action, a weekly cadence, a hold window by age (30/45/60 days), a
points-page check (claim only from official links, never pay to claim), and a farm
log plus exit plan. Every step carries a cost and a time.

## Dashboard (dashboard/)

Dark theme, chosen palette, system font stack. Board table with sortable columns
(rank, protocol, TVL, 7d, age, readiness, implied value), search, category / chain /
scope (watchlist+early / watchlist only / early only) / min-TVL filters, sort
selector, pre-token vs live-token tabs, and a detail dialog per protocol (why-this-rank
sentence, five factor bars with weights, implied-value equation, farm plan). All state
is in the URL hash, so the three screenshots are deep links to real views. No network:
no fetch/XHR, no external addresses anywhere in the dashboard files (gate-checked).

## Verification (all run 2026-11-17, local)

- `main.ts` runs clean: 758 protocols in, 40/40 watchlist covered, **227 rows**
  (40 watchlist + 187 early — the starter scores 200; this entry scores every
  rankable pre-token protocol, uncapped), 24 live-token protocols set aside.
- Board: ranks 1..227, implied values strictly non-increasing ($75.1M → $33K),
  227 distinct values, 7 farm steps per row, every step 82–199 chars (gate: 3–12
  steps, 20–600 chars), all slugs are snapshot protocols, no duplicates.
- Served `out/` on a local static server: index, data.js, app.js, app.css all 200.
- Rendered in headless Chromium (1440×900) and visually inspected all three
  screenshots: board, detail dialog (Sentora Curator, rank 1 — factor bars, equation,
  recompute line reads "the same number board.json carries"), filtered view
  (category Dexs, 21 rows shown). DOM check: 227 data rows rendered; all 7 farm
  steps in the detail dialog match board.json byte for byte.
- Dossier: 405,616 bytes (gate cap 1.5 MiB), dossier text 42,194 bytes (cap 65,536 —
  the judge reads the whole dashboard source), rebuilt dossier is byte-identical to
  what `buildDossier` writes. Screenshots 1440×900 JPEG, ~87–93KB each (cap 512 KiB,
  guidance 300–350KB).
- Gate self-check (board shape, watchlist, ranks, order, steps, implied cap,
  screenshot dims/sizes, dashboard file caps, no-network scan): all PASS.
- One fix made during verification: the first board run ranked WBTC / Coinbase
  Bridge / USDT0 / Binance Bitcoin 1–4 (all category Bridge). Added the
  Bridge/Canonical Bridge + exchange-name + wrapped-name exclusions to `isRankable`;
  the top is now Sentora Curator, Steakhouse Financial, Gauntlet, Veda.

## What the kit requires for submission (NOT done)

1. **Public GitHub repo + commit SHA.** No GitHub login exists on this machine yet
   (the `gh` CLI is not authenticated) — the repo has to be created and pushed from
   an account Topan chooses, then `repo_url` + the 40-char `commit_sha` go into the
   submission. README badges still carry the `{owner}` placeholder.
2. **Transcript bundle.** The entry needs a `.tar.gz` bundle of the agent sessions
   that built it, made by the kit's CLI (`node cli/makefun.mjs bundle`, run from
   inside the unpacked kit). Note `handed_over_places` is "none": an entry whose
   session was handed over takes no paid place — the bundle must come from a harness
   whose sessions are recorded. This was not run here; the parent agent owns it.
3. **Account wallet.** The intake check `account_wallet` requires a Solana wallet on
   the account (prizes pay on chain to the wallet that signs the entry). Per Topan
   2026-11-17 ~07:17 ("Wallet agentic aj"), payouts go to the **agent wallet
   `GaYzaeTv12xNWTUaU56wSgwBPv371ZMfjdrcr84tKcz7`**; the account @topandina's wallet
   on file is `2s2oPKbq...9V5J`. Confirm which wallet signs the entry before
   submitting (kit CLI: `node cli/makefun.mjs wallet add --keypair <file>` or link
   on the profile).
4. Submit via the kit CLI before 2026-12-14T10:00:00Z:
   `node cli/makefun.mjs submit --competition token-radar-01 --repo-url <url> --commit <sha> --title <name> --bundle <file> --keypair <file>`
   (or the equivalent multipart POST with the agent API key).

## Notes / caveats

- The starter's dashboard is the house's "2-plain" calibration anchor; this entry is
  deliberately different from it (new model, full early coverage, richer dashboard)
  and must never be submitted byte-identical to any house dashboard.
- `kit/` and `out/` are build/reference material, not part of the submitted repo
  (the repo is `main.ts`, `lib/`, `vendor/`, `dashboard/`, `screenshots/`,
  `input/`, `README.md`, `LICENSE`).
- The snapshot is frozen at 2026-11-14; the entry does not fetch live data, by
  design — the grader runs it against the same sealed bytes.
