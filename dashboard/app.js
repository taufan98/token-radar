// Token Radar's dashboard, radar-2. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, and a per-protocol detail view with the model's
// own inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', minTvl: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in functions, the same arithmetic main.ts writes to board.json: the page recomputes a
  // row from the snapshot figures and checks the number board.json carries, so the page's code and
  // the board's data are visibly the same arithmetic. No protocol name is special-cased.
  var M = DATA.model;
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function sizeScore(tvl) {
    var lo = Math.log10(M.size_floor_usd), hi = Math.log10(M.size_cap_usd);
    return clamp((Math.log10(Math.max(tvl, 1)) - lo) / (hi - lo), 0, 1);
  }
  function growthScore(g) {
    var v = clamp(g === null || g === undefined ? 0 : g, M.growth_floor, M.growth_cap);
    return (v - M.growth_floor) / (M.growth_cap - M.growth_floor);
  }
  function ageScore(age) {
    if (age === null || age === undefined) return M.unknown_age_score;
    if (age < M.age_young_days) return M.age_young_score;
    if (age < M.age_peak_days) return M.age_young_score + ((age - M.age_young_days) / (M.age_peak_days - M.age_young_days)) * (1 - M.age_young_score);
    if (age <= M.age_fade_days) return 1;
    if (age >= M.age_old_days) return M.age_fade_score;
    return 1 - ((age - M.age_fade_days) / (M.age_old_days - M.age_fade_days)) * (1 - M.age_fade_score);
  }
  function categoryPrior(category) {
    var c = (category || '').toLowerCase();
    if (c.indexOf('dex') >= 0 || c.indexOf('lending') >= 0 || c.indexOf('leveraged farm') >= 0) return 1;
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('options') >= 0 || c.indexOf('synthetic') >= 0) return 0.95;
    if (c.indexOf('yield') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('farm') >= 0) return 0.95;
    if (c.indexOf('restak') >= 0 || c.indexOf('basis trad') >= 0 || c.indexOf('risk curat') >= 0 || c.indexOf('launchpad') >= 0) return 0.9;
    if (c.indexOf('rwa') >= 0 || c.indexOf('prediction') >= 0 || c.indexOf('gaming') >= 0 || c.indexOf('nft') >= 0) return 0.85;
    if (c.indexOf('stable') >= 0 || c.indexOf('insurance') >= 0 || c.indexOf('payment') >= 0 || c.indexOf('staking') >= 0) return 0.8;
    if (c.indexOf('bridge') >= 0 || c.indexOf('oracle') >= 0 || c.indexOf('cross chain') >= 0) return 0.75;
    return 0.85;
  }
  function chainScore(chains) { return Math.min((chains || []).length, M.max_chains) / M.max_chains; }
  function factorsOf(row) {
    var size = sizeScore(row.tvl_usd);
    var growth = growthScore(row.change_7d);
    var age = ageScore(row.age_days);
    var prior = categoryPrior(row.category);
    var chains = chainScore(row.chains);
    var readiness = M.weight_size * size + M.weight_growth * growth + M.weight_age * age + M.weight_category * prior + M.weight_chains * chains;
    var alloc = M.alloc_base + M.alloc_growth * growth;
    var momentum = 1 + (clamp(row.change_7d === null ? 0 : row.change_7d, M.momentum_floor, M.momentum_cap) / 100) * M.momentum_weight;
    return { size: size, growth: growth, age: age, prior: prior, chains: chains, readiness: readiness, alloc: alloc, momentum: momentum };
  }
  function impliedOf(row) {
    var f = factorsOf(row);
    return Math.max(1, Math.round(row.tvl_usd * f.alloc * f.readiness * f.momentum));
  }
  function whyRank(row) {
    var f = factorsOf(row);
    var parts = [
      { label: 'size', text: 'its TVL of ' + fmtUsd(row.tvl_usd), v: M.weight_size * f.size },
      { label: 'growth', text: 'seven-day growth of ' + fmtPct(row.change_7d), v: M.weight_growth * f.growth },
      { label: 'age', text: 'age of ' + fmtAge(row.age_days) + ' with no token on record', v: M.weight_age * f.age },
      { label: 'category', text: 'a ' + (row.category || 'general') + ' business, which the model rates ' + f.prior.toFixed(2), v: M.weight_category * f.prior },
      { label: 'chains', text: 'presence on ' + (row.chains || []).length + ' chain' + ((row.chains || []).length === 1 ? '' : 's'), v: M.weight_chains * f.chains }
    ].sort(function (a, b) { return b.v - a.v; });
    return 'This rank is led by ' + parts[0].text + ', with ' + parts[1].text + ' behind it.';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('oracle') >= 0) return 'Use ' + name + ' as the price feed for a $' + capital + ' position on ' + chain + ' and keep it open.';
    if (c.indexOf('launchpad') >= 0) return 'Join a $' + capital + ' allocation on ' + name + ' on ' + chain + ' and hold the allocation.';
    if (c.indexOf('gaming') >= 0 || c.indexOf('nft') >= 0) return 'Spend $' + capital + ' inside ' + name + ' on ' + chain + ' and keep the assets you receive.';
    if (c.indexOf('payment') >= 0) return 'Pay $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipt.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $' + small + ' against the deposit on ' + name + ' and repay it a week later.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap $' + small + ' through ' + name + ' on ' + chain + ' so the wallet shows both a swap and a liquidity position.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a small amount back the other way through ' + name + ' so the wallet shows volume in both directions.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Use the staking receipt inside ' + name + ' on ' + chain + ' instead of leaving it idle in the wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the first hedge on ' + name + ' and open a second one half its size.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market on ' + name + ' and place a second position in a different market.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Move $' + small + ' into a second ' + name + ' vault on ' + chain + '.';
    if (c.indexOf('stable') >= 0) return 'Swap $' + small + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Claim any yield the ' + name + ' position pays on ' + chain + ' and leave it compounding.';
    if (c.indexOf('insurance') >= 0) return 'File a test claim check on ' + name + ' so the policy shows activity beyond the purchase.';
    if (c.indexOf('oracle') >= 0) return 'Read the ' + name + ' feed for a second ' + chain + ' market and keep both positions open.';
    if (c.indexOf('launchpad') >= 0) return 'Vote or signal on the next ' + name + ' launch on ' + chain + ' with the allocation you hold.';
    if (c.indexOf('gaming') >= 0 || c.indexOf('nft') >= 0) return 'Trade or use one of the assets you received inside ' + name + ' on ' + chain + '.';
    if (c.indexOf('payment') >= 0) return 'Receive $' + small + ' back through ' + name + ' on ' + chain + '.';
    return 'Use a second feature of ' + name + ' on ' + chain + ' with $' + small + ' so the wallet shows more than one kind of activity.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: 'about $' + (capital >= 150 ? 5 : 2) + ' of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, and plan the unwind before the token launches so you keep the position until the snapshot.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('scope')) state.scope = params.get('scope');
    if (params.get('mintvl')) state.minTvl = Number(params.get('mintvl')) || 0;
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.minTvl) params.set('mintvl', String(state.minTvl));
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'readiness') { av = a.readiness; bv = b.readiness; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' more pre-token protocols below and above that floor, every one the snapshot carries. Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows beyond the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function selectOpts(values, current, allLabel) {
    var opts = [el('option', { value: 'all', text: allLabel })];
    values.forEach(function (v) { opts.push(el('option', { value: v, text: v, selected: v === current ? 'selected' : null })); });
    return opts;
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' }, selectOpts(categories, state.category, 'All categories'));
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' }, selectOpts(chains, state.chain, 'All chains'));
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var scope = el('select', { id: 'scope', 'aria-label': 'Filter by scope' },
      el('option', { value: 'all', text: 'Watchlist + early', selected: state.scope === 'all' ? 'selected' : null }),
      el('option', { value: 'watchlist', text: 'Watchlist only', selected: state.scope === 'watchlist' ? 'selected' : null }),
      el('option', { value: 'early', text: 'Early only', selected: state.scope === 'early' ? 'selected' : null })
    );
    scope.addEventListener('change', function () { state.scope = scope.value; writeHash(); render(); });
    var tvl = el('select', { id: 'mintvl', 'aria-label': 'Minimum TVL' },
      [['0', 'Any TVL'], ['5000000', 'TVL $5M+'], ['50000000', 'TVL $50M+'], ['100000000', 'TVL $100M+'], ['1000000000', 'TVL $1B+']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: String(state.minTvl) === o[0] ? 'selected' : null });
      })
    );
    tvl.addEventListener('change', function () { state.minTvl = Number(tvl.value) || 0; writeHash(); render(); });
    var sort = el('select', { id: 'sort', 'aria-label': 'Sort by' },
      [['implied', 'Implied value'], ['readiness', 'Readiness'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age'], ['name', 'Name']].map(function (o) {
        return el('option', { value: o[0], text: 'Sort: ' + o[1], selected: state.sort === o[0] ? 'selected' : null });
      })
    );
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = -1; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      el('div', { class: 'field' }, el('label', { for: 'scope', text: 'Scope' }), scope),
      el('div', { class: 'field' }, el('label', { for: 'mintvl', text: 'Min TVL' }), tvl),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort' }), sort),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all'; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null, el('b', { text: r.name }), r.on_watchlist ? el('span', { class: 'badge', text: 'watchlist' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'readiness' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round(r.readiness * 100)) + '%' })),
          el('span', { class: 'num', text: (r.readiness * 100).toFixed(0) })
        )),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('readiness', 'Readiness'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var wrows = [
      ['Size (log TVL)', m.weight_size],
      ['Seven-day growth', m.weight_growth],
      ['Age with no token', m.weight_age],
      ['Category prior', m.weight_category],
      ['Chain breadth', m.weight_chains]
    ].map(function (w) {
      return el('tr', null, el('td', { text: w[0] }), el('td', { class: 'num', text: (w[1] * 100).toFixed(0) + '%' }));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'readiness = ' + m.weight_size + ' x size + ' + m.weight_growth + ' x growth + ' + m.weight_age + ' x age + ' + m.weight_category + ' x category + ' + m.weight_chains + ' x chains\n' +
        'implied = round( tvl_usd x (' + m.alloc_base + ' + ' + m.alloc_growth + ' x growth) x readiness x momentum )'
      ),
      el('table', { class: 'weights' }, el('tbody', null, wrows)),
      el('p', { class: 'sub', text: 'Size is log-scaled TVL between $' + (m.size_floor_usd / 1e6) + 'M and $' + (m.size_cap_usd / 1e9) + 'B, so a protocol ten times larger is not ten times likelier to launch. Growth is the seven-day change clamped to ' + m.growth_floor + '%..' + m.growth_cap + '%. Age is a sweet spot: under ' + m.age_young_days + ' days scores low, 1-3 years scores full, and much older with still no token fades. The category prior rates token-shaped businesses above oracles and payment rails. Exchanges, bridges, versioned pools, wrapped products and exchange-named products are left out: a wrapped asset is not a protocol waiting on a launch of its own. Momentum scales the pool by recent growth.' }),
      el('p', { class: 'sub', text: '"No token" means the index records no token for the protocol, not proof it has none. The early radar carries every rankable pre-token protocol the snapshot holds, at any TVL, so a future snapshot finds future launches early. Implied value is the model\'s estimate of the airdrop pool, never a price and never a promise.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function factorBar(label, score, weight) {
    return el('div', { class: 'factor' },
      el('span', { text: label }),
      el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round(score * 100)) + '%' })),
      el('span', { class: 'num', text: score.toFixed(2) }),
      el('span', { class: 'w', text: 'x ' + weight.toFixed(2) })
    );
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    var f = factorsOf(row);
    var recomputed = impliedOf(row);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? '  ·  on the watchlist' : '  ·  early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '  ·  DefiLlama slug: ' + row.slug })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why this rank' }),
      el('p', { class: 'sub', text: whyRank(row) }),
      factorBar('Size (log TVL)', f.size, M.weight_size),
      factorBar('Seven-day growth', f.growth, M.weight_growth),
      factorBar('Age with no token', f.age, M.weight_age),
      factorBar('Category prior', f.prior, M.weight_category),
      factorBar('Chain breadth', f.chains, M.weight_chains)
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Readiness' }), el('b', { class: 'num', text: f.readiness.toFixed(2) })),
        el('div', null, el('span', { text: 'Airdrop pool rate' }), el('b', { class: 'num', text: (f.alloc * 100).toFixed(1) + '%' })),
        el('div', null, el('span', { text: 'Momentum' }), el('b', { class: 'num', text: f.momentum.toFixed(2) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, farmSteps(row).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Snapshot ' + DATA.as_of + ' from the DefiLlama protocol index. "No token" means no token is recorded for the protocol. Implied values are model estimates, not prices, and farming any protocol carries the risk of losing the capital you put in.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
