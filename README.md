# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/taufan98/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/taufan98/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar is a token launch radar: a program that reads a sealed snapshot of the
protocol universe, scores every pre-token protocol by the implied value of its future
airdrop, and writes a dashboard that shows a reader which protocol is worth farming
next — and exactly what to do about it.

The board covers all 40 protocols on the snapshot's watchlist plus every other
rankable pre-token protocol the snapshot carries (227 rows on the 2026-11-14 snapshot),
ranks them by a stated five-factor model (log-scaled TVL, seven-day growth, age with no
token, category prior, chain breadth), and gives each one a seven-step farm plan with
costs and times. Protocols whose token already trades are set aside with their market
caps shown. "No token" means the index records no token for the protocol, not proof it
has none — and the implied value is the model's estimate of the airdrop pool, never a
price and never a promise.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Node.js 22.18 or later, standard library only, no install and no build step. `main.ts`
writes `out/board.json`, `out/data.js`, `out/dashboard/` (the static page), copies
`out/screenshots/`, and writes `out/dossier.json` last. Serve `out/` with any static
server to open the dashboard, for example:

```sh
cd out && python3 -m http.server 8137
```

Then open `http://127.0.0.1:8137/dashboard/index.html`.

## Layout

- `main.ts` — the entry program: reads the snapshot, writes the board, the dashboard
  data, and the dossier.
- `lib/model.ts` — the radar-2 model: eligibility, the five-factor readiness score,
  the implied value, and the farm plans. One function scores every row; no protocol
  name is special-cased.
- `vendor/makefun-board.ts` — make.fun's dashboard-dossier library, byte for byte the
  kit's copy.
- `dashboard/` — the static page (no framework, no network): the board, filters and
  sorting, a detail view per protocol, and the model stated in full.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `input/snapshot.json` — the sealed snapshot this entry was built against (DefiLlama
  protocol index, fetched 2026-11-14). The grader mounts its own copy at `/input`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)</sub>
