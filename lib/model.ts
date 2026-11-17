// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the snapshot carries, at any TVL: the early radar exists to find future
// launches early, so it is capped by eligibility, never by count. A protocol is pre-token when its
// index entry records no token (no market cap, no CoinGecko id, no symbol); the snapshot's
// live-token protocols are kept apart and shown as the market's own values, never mixed into the
// ranked board. A protocol whose name is a wrapped, staked or staking product of a token that
// already trades is not a launch candidate and is left out, as is any exchange, any bridge,
// any versioned pool, and any product named for an exchange.
//
// Implied value follows only from the snapshot's own figures. Five factors, each 0..1, combine
// into a launch readiness, and the implied value is the modeled airdrop pool that readiness
// supports:
//
//   size      = log-scaled TVL between $5M (0) and $200B (1): value grows with size, but a
//               protocol ten times larger is not ten times likelier to launch.
//   growth    = clamp(change_7d, -40, 150) mapped to 0..1: momentum is the market voting.
//   age       = a sweet spot over age_days: too young is unproven, 1-3 years with no token is
//               the launch window, much older with still no token fades (if it were coming soon,
//               it would likely have come by now). Unknown age scores 0.5.
//   category  = a stated prior per category (see CATEGORY_PRIOR): token-shaped businesses
//               (Dexs, Lending, Derivatives) score above infra that rarely launches its own
//               token (Bridges, Oracles).
//   chains    = min(chains, 6) / 6: wider distribution, wider future holder base.
//
//   readiness = 0.30*size + 0.25*growth + 0.20*age + 0.15*category + 0.10*chains
//   alloc     = 0.02 + 0.10*growth          (the modeled airdrop pool is 2-12% of TVL)
//   momentum  = 1 + clamp(change_7d, -30, 100)/100 * 0.5
//   implied   = max(1, round(tvl_usd * alloc * readiness * momentum))
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  size_floor_usd: number;
  size_cap_usd: number;
  growth_floor: number;
  growth_cap: number;
  momentum_floor: number;
  momentum_cap: number;
  momentum_weight: number;
  alloc_base: number;
  alloc_growth: number;
  weight_size: number;
  weight_growth: number;
  weight_age: number;
  weight_category: number;
  weight_chains: number;
  age_young_days: number;
  age_peak_days: number;
  age_fade_days: number;
  age_old_days: number;
  age_young_score: number;
  age_fade_score: number;
  unknown_age_days: number;
  unknown_age_score: number;
  max_chains: number;
}

export const MODEL: ModelConstants = {
  size_floor_usd: 5_000_000,
  size_cap_usd: 200_000_000_000,
  growth_floor: -40,
  growth_cap: 150,
  momentum_floor: -30,
  momentum_cap: 100,
  momentum_weight: 0.5,
  alloc_base: 0.02,
  alloc_growth: 0.1,
  weight_size: 0.3,
  weight_growth: 0.25,
  weight_age: 0.2,
  weight_category: 0.15,
  weight_chains: 0.1,
  age_young_days: 30,
  age_peak_days: 365,
  age_fade_days: 1095,
  age_old_days: 1825,
  age_young_score: 0.15,
  age_fade_score: 0.55,
  unknown_age_days: 365,
  unknown_age_score: 0.5,
  max_chains: 6,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    growth_pct: number;
    momentum: number;
    readiness: number;
    size_score: number;
    growth_score: number;
    age_score: number;
    category_prior: number;
    chain_score: number;
    allocation_rate: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  readiness: number;
  size_score: number;
  growth_score: number;
  age_score: number;
  category_prior: number;
  chain_score: number;
  momentum: number;
  allocation_rate: number;
  on_watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A number clamped into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Size factor: log-scaled TVL between the model's floor and cap, 0..1. */
export function sizeScore(tvlUsd: number, model: ModelConstants): number {
  const lo = Math.log10(model.size_floor_usd);
  const hi = Math.log10(model.size_cap_usd);
  return clamp((Math.log10(Math.max(tvlUsd, 1)) - lo) / (hi - lo), 0, 1);
}

/** Growth factor: seven-day change clamped and mapped to 0..1. */
export function growthScore(change7d: number | null, model: ModelConstants): number {
  const g = clamp(finite(change7d, 0), model.growth_floor, model.growth_cap);
  return (g - model.growth_floor) / (model.growth_cap - model.growth_floor);
}

/** Age factor: the launch window is a sweet spot, not a straight line up. */
export function ageScore(age: number | null, model: ModelConstants): number {
  if (age === null) return model.unknown_age_score;
  if (age < model.age_young_days) return model.age_young_score;
  if (age < model.age_peak_days) {
    const t = (age - model.age_young_days) / (model.age_peak_days - model.age_young_days);
    return model.age_young_score + t * (1 - model.age_young_score);
  }
  if (age <= model.age_fade_days) return 1;
  if (age >= model.age_old_days) return model.age_fade_score;
  const t = (age - model.age_fade_days) / (model.age_old_days - model.age_fade_days);
  return 1 - t * (1 - model.age_fade_score);
}

/** The category's launch prior, 0.75..1. A stated table, never a list of protocol names. */
export function categoryPrior(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('dex') || c.includes('lending') || c.includes('leveraged farm')) return 1;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetic')) return 0.95;
  if (c.includes('yield') || c.includes('cdp') || c.includes('collateral') || c.includes('farm')) return 0.95;
  if (c.includes('restak') || c.includes('basis trad') || c.includes('risk curat') || c.includes('launchpad')) return 0.9;
  if (c.includes('rwa') || c.includes('prediction') || c.includes('gaming') || c.includes('nft')) return 0.85;
  if (c.includes('stable') || c.includes('insurance') || c.includes('payment') || c.includes('staking')) return 0.8;
  if (c.includes('bridge') || c.includes('oracle') || c.includes('cross chain')) return 0.75;
  return 0.85;
}

/** Chain-breadth factor: more chains, wider future holder base, capped. */
export function chainScore(chains: string[], model: ModelConstants): number {
  return Math.min(chains.length, model.max_chains) / model.max_chains;
}

/** The five factors, the readiness and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  growthPct: number;
  momentum: number;
  readiness: number;
  size: number;
  growth: number;
  age: number;
  prior: number;
  chains: number;
  allocation: number;
  ageDaysValue: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = clamp(finite(protocol.change_7d, 0), model.growth_floor, model.growth_cap);
  const size = sizeScore(protocol.tvl_usd, model);
  const growth = growthScore(protocol.change_7d, model);
  const ageF = ageScore(age, model);
  const prior = categoryPrior(protocol.category);
  const chains = chainScore(protocol.chains, model);
  const readiness =
    model.weight_size * size +
    model.weight_growth * growth +
    model.weight_age * ageF +
    model.weight_category * prior +
    model.weight_chains * chains;
  const allocation = model.alloc_base + model.alloc_growth * growth;
  const momentum = 1 + (clamp(finite(protocol.change_7d, 0), model.momentum_floor, model.momentum_cap) / 100) * model.momentum_weight;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * allocation * readiness * momentum));
  return { implied, growthPct, momentum, readiness, size, growth, age: ageF, prior, chains, allocation, ageDaysValue: age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name that is a wrapped, staked or staking product of a token that already trades. */
const WRAPPED = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name: the exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Categories the board never ranks: exchanges, and bridges, which move other chains' assets. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange or a bridge, not a
 * versioned pool, not a wrapped product of a token that already trades, and not an exchange's own
 * product. A wrapped asset is not a protocol still waiting on a launch of its own: WBTC is Bitcoin
 * on Ethereum, and a bridge is the road other tokens travel on. Liquid staking and restaking
 * protocols stay in: they are protocols in their own right, and they do launch tokens.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol the snapshot carries, at any TVL.
  // Capped by eligibility, never by count: that is what "find future launches early" means.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.ageDaysValue,
    implied_value_usd: s.v.implied,
    model: {
      growth_pct: round4(s.v.growthPct),
      momentum: round4(s.v.momentum),
      readiness: round4(s.v.readiness),
      size_score: round4(s.v.size),
      growth_score: round4(s.v.growth),
      age_score: round4(s.v.age),
      category_prior: round4(s.v.prior),
      chain_score: round4(s.v.chains),
      allocation_rate: round4(s.v.allocation),
      age_days: s.v.ageDaysValue,
    },
    farm_steps: farmSteps(s.p, s.v.ageDaysValue).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('oracle')) return `Use ${name} as the price feed for a $${capital} position on ${chain} and keep it open.`;
  if (c.includes('launchpad')) return `Join a $${capital} allocation on ${name} on ${chain} and hold the allocation.`;
  if (c.includes('gaming') || c.includes('nft')) return `Spend $${capital} inside ${name} on ${chain} and keep the assets you receive.`;
  if (c.includes('payment')) return `Pay $${capital} through ${name} on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second feature: a farm counts when more than one part of the app is used. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${Math.max(10, Math.round(capital / 5))} against the deposit on ${name} and repay it a week later.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${Math.max(10, Math.round(capital / 5))} through ${name} on ${chain} so the wallet shows both a swap and a liquidity position.`;
  if (c.includes('bridge')) return `Bridge a small amount back the other way through ${name} so the wallet shows volume in both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Use the staking receipt inside ${name} on ${chain} instead of leaving it idle in the wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the first hedge on ${name} and open a second one half its size.`;
  if (c.includes('prediction')) return `Settle one market on ${name} and place a second position in a different market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $${Math.max(10, Math.round(capital / 5))} into a second ${name} vault on ${chain}.`;
  if (c.includes('stable')) return `Swap $${Math.max(10, Math.round(capital / 5))} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Claim any yield the ${name} position pays on ${chain} and leave it compounding.`;
  if (c.includes('insurance')) return `File a test claim check on ${name} so the policy shows activity beyond the purchase.`;
  if (c.includes('oracle')) return `Read the ${name} feed for a second ${chain} market and keep both positions open.`;
  if (c.includes('launchpad')) return `Vote or signal on the next ${name} launch on ${chain} with the allocation you hold.`;
  if (c.includes('gaming') || c.includes('nft')) return `Trade or use one of the assets you received inside ${name} on ${chain}.`;
  if (c.includes('payment')) return `Receive $${Math.max(10, Math.round(capital / 5))} back through ${name} on ${chain}.`;
  return `Use a second feature of ${name} on ${chain} with $${Math.max(10, Math.round(capital / 5))} so the wallet shows more than one kind of activity.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${capital >= 150 ? 5 : 2} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and plan the unwind before the token launches so you keep the position until the snapshot.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    readiness: row.model.readiness,
    size_score: row.model.size_score,
    growth_score: row.model.growth_score,
    age_score: row.model.age_score,
    category_prior: row.model.category_prior,
    chain_score: row.model.chain_score,
    momentum: row.model.momentum,
    allocation_rate: row.model.allocation_rate,
    on_watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch.has(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value over the gate cap`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
