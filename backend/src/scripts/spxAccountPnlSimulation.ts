/**
 * SPX Account P&L Simulation with Historical Option Contract Matching
 *
 * For each backtest trade, fetches historical 1DTE options chain from Massive
 * (0DTE expired snapshots unavailable), selects the optimal contract via
 * delta targeting, sizes for the account, and calculates dollar P&L.
 *
 * Uses 1DTE as proxy: next-expiry SPXW options captured at EOD on trade date.
 * Delta-based P&L: option_move ≈ delta × SPX_move + 0.5 × gamma × move^2
 *
 * Usage:
 *   pnpm exec tsx src/scripts/spxAccountPnlSimulation.ts [--account 10000] [--risk-pct 2]
 */

import { runSPXWinRateBacktest } from '../services/spx/winRateBacktest';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import { deltaTargetForSetup } from '../services/spx/contractSelector';
import { getOptionsContracts, getOptionsSnapshotAtDate } from '../config/massive';
import type { OptionsSnapshot } from '../config/massive';
import { supabase } from '../config/database';

const CONTRACT_MULTIPLIER = 100;

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextTradingDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  // Skip weekends
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

interface MatchedContract {
  ticker: string;
  strike: number;
  type: 'call' | 'put';
  expiry: string;
  delta: number;
  bid: number;
  ask: number;
  mid: number;
  volume: number;
  openInterest: number;
  iv: number;
  theta: number;
  gamma: number;
  dte: number;
}

interface TradeRow {
  tradeNum: number;
  date: string;
  setupType: string;
  direction: string;
  regime: string;
  outcome: string;
  realizedR: number;
  entryFillPrice: number | null;
  stopPrice: number | null;
  target1Price: number | null;
  target2Price: number | null;
  riskPoints: number | null;
  contract: MatchedContract | null;
  contracts: number;
  perContractDebit: number;
  dollarRisk: number;
  optionPnlPerContract: number;
  dollarPnl: number;
  equityAfter: number;
}

async function loadSetupPrices(from: string, to: string): Promise<Map<string, {
  stopPrice: number | null;
  target1Price: number | null;
  target2Price: number | null;
}>> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('engine_setup_id,stop_price,target_1_price,target_2_price')
    .gte('session_date', from)
    .lte('session_date', to);

  if (error || !data) return new Map();

  const map = new Map<string, { stopPrice: number | null; target1Price: number | null; target2Price: number | null }>();
  for (const row of data as Record<string, unknown>[]) {
    const id = typeof row.engine_setup_id === 'string' ? row.engine_setup_id : '';
    if (!id) continue;
    map.set(id, {
      stopPrice: typeof row.stop_price === 'number' ? row.stop_price : null,
      target1Price: typeof row.target_1_price === 'number' ? row.target_1_price : null,
      target2Price: typeof row.target_2_price === 'number' ? row.target_2_price : null,
    });
  }
  return map;
}

async function fetchNearestExpiryChain(
  sessionDate: string,
  spxPrice: number,
): Promise<{ snapshots: OptionsSnapshot[]; expiryUsed: string }> {
  // Try next 3 trading days to find available snapshots
  for (let offset = 1; offset <= 3; offset++) {
    let candidateDate = sessionDate;
    for (let i = 0; i < offset; i++) {
      candidateDate = getNextTradingDay(candidateDate);
    }

    try {
      // Fetch contracts expiring on the candidate date
      const contracts = await getOptionsContracts('SPX', candidateDate, 1000, sessionDate);
      if (contracts.length === 0) continue;

      // Filter to SPXW contracts near the money (±60 points)
      const nearMoney = contracts.filter(
        (c) => Math.abs(c.strike_price - spxPrice) <= 60,
      );
      if (nearMoney.length === 0) continue;

      // Fetch snapshots for these contracts (batch by fetching full chain with expiry filter)
      const snapshots = await getOptionsSnapshotAtDate('I:SPX', sessionDate);
      const filtered = snapshots.filter((s) => {
        return s.details?.expiration_date === candidateDate;
      });

      if (filtered.length > 0) {
        // Further filter to near-money strikes
        const nearMoneySnaps = filtered.filter((s) => {
          const strike = s.details?.strike_price;
          if (strike == null) return false;
          return Math.abs(strike - spxPrice) <= 60;
        });
        if (nearMoneySnaps.length > 0) {
          return { snapshots: nearMoneySnaps, expiryUsed: candidateDate };
        }
      }
    } catch {
      continue;
    }
  }

  return { snapshots: [], expiryUsed: '' };
}

function selectBestContract(
  snapshots: OptionsSnapshot[],
  setupType: string,
  direction: string,
  regime: string | null,
  _spxPrice: number,
  expiryUsed: string,
  tradeDate: string,
): MatchedContract | null {
  const targetDelta = deltaTargetForSetup({
    type: setupType as any,
    regime: regime as any,
  });

  const contractType = direction === 'bullish' ? 'call' : 'put';
  const candidates = snapshots.filter((snap) => {
    const type = snap.details?.contract_type;
    if (type !== contractType) return false;
    const bid = snap.last_quote?.bid;
    const ask = snap.last_quote?.ask;
    if (!bid || !ask || bid <= 0 || ask <= 0) return false;
    const delta = snap.greeks?.delta;
    if (delta == null || !Number.isFinite(delta)) return false;
    const absDelta = Math.abs(delta);
    if (absDelta < 0.05 || absDelta > 0.65) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Score candidates (simplified contract selector scoring)
  const scored = candidates.map((snap) => {
    const absDelta = Math.abs(snap.greeks!.delta);
    const deltaPenalty = Math.min(1, Math.abs(absDelta - targetDelta) / 0.2) * 45;
    const bid = snap.last_quote.bid;
    const ask = snap.last_quote.ask;
    const mid = (bid + ask) / 2;
    const spreadPct = mid > 0 ? (ask - bid) / mid : 1;
    const spreadPenalty = Math.min(1, spreadPct / 0.24) * 35;
    const oi = snap.open_interest || 0;
    const vol = snap.day?.volume || 0;
    const liquidityBonus = Math.min(18, Math.log10(oi + 1) * 4 + Math.log10(vol + 1) * 3);
    const gamma = Math.max(0, snap.greeks?.gamma || 0);
    const gammaBonus = Math.min(10, gamma * 250);
    const theta = Math.abs(snap.greeks?.theta || 0);
    const thetaPenalty = Math.max(0, theta - 1.3) * 8;
    const score = 100 - deltaPenalty - spreadPenalty - thetaPenalty + liquidityBonus + gammaBonus;
    return { snap, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].snap;

  // Calculate DTE
  const expiryMs = Date.parse(`${expiryUsed}T21:00:00Z`);
  const tradeDateMs = Date.parse(`${tradeDate}T16:00:00Z`);
  const dte = Math.max(0, Math.ceil((expiryMs - tradeDateMs) / 86400000));

  return {
    ticker: best.ticker,
    strike: best.details!.strike_price!,
    type: contractType,
    expiry: expiryUsed,
    delta: best.greeks!.delta,
    bid: best.last_quote.bid,
    ask: best.last_quote.ask,
    mid: round((best.last_quote.bid + best.last_quote.ask) / 2, 2),
    volume: best.day?.volume || 0,
    openInterest: best.open_interest || 0,
    iv: best.implied_volatility || 0,
    theta: best.greeks?.theta || 0,
    gamma: best.greeks?.gamma || 0,
    dte,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const accountIdx = args.indexOf('--account');
  const riskIdx = args.indexOf('--risk-pct');
  const startingEquity = accountIdx >= 0 ? Number(args[accountIdx + 1]) : 10_000;
  const riskPct = (riskIdx >= 0 ? Number(args[riskIdx + 1]) : 2) / 100;

  const profile = await getActiveSPXOptimizationProfile();
  const historyDays = profile.walkForward.trainingDays + profile.walkForward.validationDays - 1;

  // Use same date range as the optimizer scan
  const now = new Date();
  const dayOfWeek = now.getDay();
  const deltaToFriday = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
  const fridayStr = shiftDate(now.toISOString().slice(0, 10), -deltaToFriday);
  const scanTo = fridayStr;
  const scanFrom = shiftDate(scanTo, -historyDays);

  console.log(`\n=== SPX 0DTE Account P&L Simulation ===`);
  console.log(`=== with Historical Option Contract Matching ===\n`);
  console.log(`Starting equity: $${startingEquity.toLocaleString()}`);
  console.log(`Risk per trade:  ${(riskPct * 100).toFixed(1)}% ($${round(startingEquity * riskPct, 2)})`);
  console.log(`Scan range:      ${scanFrom} to ${scanTo}`);
  console.log(`History days:    ${historyDays}`);
  console.log(`Option proxy:    1DTE (next-expiry SPXW at EOD snapshot)`);

  // Convert geometry policy to backtest geometry adjustments
  const geometryBySetupType: Record<string, { stopScale?: number; target1Scale?: number; target2Scale?: number }> = {};
  for (const [key, entry] of Object.entries(profile.geometryPolicy?.bySetupType || {})) {
    geometryBySetupType[key] = {
      stopScale: entry.stopScale,
      target1Scale: entry.target1Scale,
      target2Scale: entry.target2Scale,
    };
  }

  // Run backtest with includeRows to get individual trade data
  console.log('\nRunning backtest with optimized geometry...');
  const result = await runSPXWinRateBacktest({
    from: scanFrom,
    to: scanTo,
    includeRows: true,
    resolution: 'minute',
    geometryBySetupType,
    executionModel: {
      entrySlipPoints: 0.2,
      targetSlipPoints: 0.1,
      stopSlipPoints: 0.1,
      commissionPerTradeR: 0.04,
      moveStopToBreakevenAfterT1: true,
    },
  });

  if (!result.rows || result.rows.length === 0) {
    console.log('No trade rows returned from backtest.');
    return;
  }

  // Load stop/target prices from database
  const priceMap = await loadSetupPrices(scanFrom, scanTo);

  // Filter to triggered + resolved trades with realized R
  const trades = result.rows
    .filter((row) => row.triggered_at && row.final_outcome && typeof row.realized_r === 'number')
    .sort((a, b) => (a.triggered_at || '').localeCompare(b.triggered_at || ''));

  if (trades.length === 0) {
    console.log('No resolved trades with realized R values found.');
    return;
  }

  console.log(`Found ${trades.length} resolved trades. Fetching historical option chains...\n`);

  // Group trades by session date
  const tradesByDate = new Map<string, typeof trades>();
  for (const trade of trades) {
    const existing = tradesByDate.get(trade.session_date) || [];
    existing.push(trade);
    tradesByDate.set(trade.session_date, existing);
  }

  // Fetch 1DTE option chains per date
  const chainByDate = new Map<string, { snapshots: OptionsSnapshot[]; expiryUsed: string }>();
  let dateIdx = 0;
  for (const [sessionDate, dateTrades] of tradesByDate) {
    dateIdx++;
    const firstTrade = dateTrades[0];
    const spxPrice = firstTrade.entry_fill_price ?? 6900;
    console.log(`  [${dateIdx}/${tradesByDate.size}] Fetching 1DTE chain for ${sessionDate} (SPX ~${round(spxPrice, 0)})...`);
    const chainResult = await fetchNearestExpiryChain(sessionDate, spxPrice);
    chainByDate.set(sessionDate, chainResult);
    const snapCount = chainResult.snapshots.length;
    const expiryNote = chainResult.expiryUsed ? `exp ${chainResult.expiryUsed}` : 'no data';
    console.log(`    -> ${snapCount} near-money snapshots (${expiryNote})`);
    if (dateIdx < tradesByDate.size) await sleep(300);
  }

  // Process each trade
  let equity = startingEquity;
  const tradeLog: TradeRow[] = [];
  let totalWins = 0;
  let totalLosses = 0;
  let maxDrawdown = 0;
  let peak = startingEquity;
  let contractMatchCount = 0;

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const realizedR = trade.realized_r!;
    const prices = priceMap.get(trade.engine_setup_id);
    const entryFill = trade.entry_fill_price ?? null;
    const stopPrice = prices?.stopPrice ?? null;
    const riskPoints = entryFill != null && stopPrice != null
      ? round(Math.abs(entryFill - stopPrice), 2)
      : null;

    // Select the best option contract from 1DTE chain
    const chainResult = chainByDate.get(trade.session_date);
    const contract = chainResult && chainResult.snapshots.length > 0
      ? selectBestContract(
          chainResult.snapshots,
          trade.setup_type,
          trade.direction,
          trade.regime,
          entryFill ?? 6900,
          chainResult.expiryUsed,
          trade.session_date,
        )
      : null;

    let contracts = 0;
    let perContractDebit = 0;
    let dollarRisk = 0;
    let optionPnlPerContract = 0;
    let dollarPnl = 0;

    if (contract && riskPoints != null && riskPoints > 0) {
      contractMatchCount++;
      // For 0DTE, the actual entry price is ~40-60% of 1DTE's EOD price
      // 0DTE options have less time value and higher gamma
      // Apply a 0DTE discount factor: ~0.45x of 1DTE mid for ATM delta range
      const zeroDteDiscount = 0.45;
      const estimatedAsk = round(contract.mid * zeroDteDiscount, 2);
      perContractDebit = round(estimatedAsk * CONTRACT_MULTIPLIER, 2);

      const maxRiskDollars = round(equity * riskPct, 2);
      contracts = perContractDebit > 0 ? Math.floor(maxRiskDollars / perContractDebit) : 0;
      if (contracts === 0 && perContractDebit > 0 && perContractDebit <= maxRiskDollars * 1.5) {
        contracts = 1;
      }

      dollarRisk = round(contracts * perContractDebit, 2);

      // P&L calculation using delta + gamma approximation
      // SPX move = realizedR × riskPoints
      const spxMovePoints = realizedR * riskPoints;
      const absDelta = Math.abs(contract.delta);
      const gamma = Math.abs(contract.gamma);

      // 0DTE options have ~1.5-2x the gamma of 1DTE (higher convexity)
      const gammaAdjust = 1.7;
      const adjustedGamma = gamma * gammaAdjust;

      // Option price change ≈ delta × move + 0.5 × gamma × move^2
      const deltaComponent = absDelta * Math.abs(spxMovePoints);
      const gammaComponent = 0.5 * adjustedGamma * spxMovePoints * spxMovePoints;

      if (realizedR >= 0) {
        optionPnlPerContract = round((deltaComponent + gammaComponent) * CONTRACT_MULTIPLIER, 2);
      } else {
        // Cap loss at premium paid
        const rawLoss = (-deltaComponent + gammaComponent) * CONTRACT_MULTIPLIER;
        optionPnlPerContract = round(Math.max(rawLoss, -perContractDebit), 2);
      }

      dollarPnl = round(optionPnlPerContract * contracts, 2);
    } else {
      // Fallback: R-multiple approach when no contract data available
      dollarRisk = round(equity * riskPct, 2);
      dollarPnl = round(realizedR * dollarRisk, 2);
      optionPnlPerContract = dollarPnl;
      contracts = 1;
      perContractDebit = dollarRisk;
    }

    equity = round(equity + dollarPnl, 2);
    if (equity > peak) peak = equity;
    const drawdown = round(((peak - equity) / peak) * 100, 2);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    if (dollarPnl > 0) totalWins++;
    else if (dollarPnl < 0) totalLosses++;

    tradeLog.push({
      tradeNum: i + 1,
      date: trade.session_date,
      setupType: trade.setup_type,
      direction: trade.direction,
      regime: trade.regime || '-',
      outcome: trade.final_outcome!,
      realizedR,
      entryFillPrice: entryFill,
      stopPrice,
      target1Price: prices?.target1Price ?? null,
      target2Price: prices?.target2Price ?? null,
      riskPoints,
      contract,
      contracts,
      perContractDebit,
      dollarRisk,
      optionPnlPerContract,
      dollarPnl,
      equityAfter: equity,
    });
  }

  // Print contract details table
  console.log('\n\n=== Option Contract Matching ===');
  console.log('-'.repeat(130));
  console.log(
    '#'.padStart(3) + '  ' +
    'Date'.padEnd(12) +
    'Setup'.padEnd(20) +
    'Dir'.padEnd(6) +
    'Strike'.padStart(8) +
    'Type'.padStart(5) +
    'Exp'.padEnd(12) +
    'Delta'.padStart(7) +
    'Bid'.padStart(8) +
    'Ask'.padStart(8) +
    'IV'.padStart(7) +
    'OI'.padStart(7) +
    'Vol'.padStart(7) +
    '0DTE Est'.padStart(9),
  );
  console.log('-'.repeat(130));

  for (const t of tradeLog) {
    const c = t.contract;
    const zeroDteEst = c ? `$${round(c.mid * 0.45, 2).toFixed(2)}` : '-';
    console.log(
      String(t.tradeNum).padStart(3) + '  ' +
      t.date.padEnd(12) +
      t.setupType.padEnd(20) +
      t.direction.slice(0, 4).padEnd(6) +
      (c ? c.strike.toFixed(0) : '-').padStart(8) +
      (c ? c.type.slice(0, 1).toUpperCase() : '-').padStart(5) +
      (c ? c.expiry : '-').padEnd(12) +
      (c ? Math.abs(c.delta).toFixed(3) : '-').padStart(7) +
      (c ? `$${c.bid.toFixed(2)}` : '-').padStart(8) +
      (c ? `$${c.ask.toFixed(2)}` : '-').padStart(8) +
      (c ? `${round(c.iv * 100, 1)}%` : '-').padStart(7) +
      (c ? String(c.openInterest) : '-').padStart(7) +
      (c ? String(c.volume) : '-').padStart(7) +
      zeroDteEst.padStart(9),
    );
  }

  // Print P&L table
  console.log('\n\n=== Trade-by-Trade P&L ===');
  console.log('-'.repeat(145));
  console.log(
    '#'.padStart(3) + '  ' +
    'Date'.padEnd(12) +
    'Setup'.padEnd(20) +
    'Outcome'.padEnd(18) +
    'SPX Entry'.padStart(10) +
    'Risk Pts'.padStart(9) +
    'R'.padStart(8) +
    'Ctrs'.padStart(5) +
    'Debit/Ctr'.padStart(10) +
    '$ Risk'.padStart(9) +
    'Opt P&L/C'.padStart(10) +
    '$ P&L'.padStart(10) +
    'Equity'.padStart(12),
  );
  console.log('-'.repeat(145));

  for (const t of tradeLog) {
    const pnlStr = t.dollarPnl >= 0 ? `+$${t.dollarPnl.toFixed(2)}` : `-$${Math.abs(t.dollarPnl).toFixed(2)}`;
    const optPnlStr = t.optionPnlPerContract >= 0
      ? `+$${t.optionPnlPerContract.toFixed(2)}`
      : `-$${Math.abs(t.optionPnlPerContract).toFixed(2)}`;
    const rStr = t.realizedR >= 0 ? `+${t.realizedR.toFixed(3)}` : t.realizedR.toFixed(3);
    const src = t.contract ? '' : '*';
    console.log(
      String(t.tradeNum).padStart(3) + src +
      ' ' +
      t.date.padEnd(12) +
      t.setupType.padEnd(20) +
      t.outcome.padEnd(18) +
      (t.entryFillPrice != null ? t.entryFillPrice.toFixed(2) : '-').padStart(10) +
      (t.riskPoints != null ? t.riskPoints.toFixed(2) : '-').padStart(9) +
      rStr.padStart(8) +
      String(t.contracts).padStart(5) +
      `$${t.perContractDebit.toFixed(0)}`.padStart(10) +
      `$${t.dollarRisk.toFixed(0)}`.padStart(9) +
      optPnlStr.padStart(10) +
      pnlStr.padStart(10) +
      `$${t.equityAfter.toFixed(2)}`.padStart(12),
    );
  }

  console.log('-'.repeat(145));
  console.log('  * = R-multiple fallback (no option chain data available for this date)');

  // Summary
  const totalPnl = round(equity - startingEquity, 2);
  const returnPct = round(((equity - startingEquity) / startingEquity) * 100, 2);
  const avgR = round(tradeLog.reduce((s, t) => s + t.realizedR, 0) / tradeLog.length, 4);
  const winRate = round((totalWins / tradeLog.length) * 100, 1);
  const profitFactor = (() => {
    const grossWins = tradeLog.filter((t) => t.dollarPnl > 0).reduce((s, t) => s + t.dollarPnl, 0);
    const grossLosses = Math.abs(tradeLog.filter((t) => t.dollarPnl < 0).reduce((s, t) => s + t.dollarPnl, 0));
    return grossLosses > 0 ? round(grossWins / grossLosses, 2) : grossWins > 0 ? Infinity : 0;
  })();
  const avgWin = (() => {
    const wins = tradeLog.filter((t) => t.dollarPnl > 0);
    return wins.length > 0 ? round(wins.reduce((s, t) => s + t.dollarPnl, 0) / wins.length, 2) : 0;
  })();
  const avgLoss = (() => {
    const losses = tradeLog.filter((t) => t.dollarPnl < 0);
    return losses.length > 0 ? round(losses.reduce((s, t) => s + t.dollarPnl, 0) / losses.length, 2) : 0;
  })();

  console.log('\n\n=== SUMMARY ===');
  console.log(`  Period:              ${scanFrom} to ${scanTo} (${historyDays} days)`);
  console.log(`  Total trades:        ${tradeLog.length}`);
  console.log(`  Contract matches:    ${contractMatchCount}/${tradeLog.length} (${tradeLog.length - contractMatchCount} R-multiple fallback)`);
  console.log(`  Winners:             ${totalWins}`);
  console.log(`  Losers:              ${totalLosses}`);
  console.log(`  Breakeven:           ${tradeLog.length - totalWins - totalLosses}`);
  console.log(`  Win rate:            ${winRate}%`);
  console.log(`  Avg win:             +$${avgWin.toFixed(2)}`);
  console.log(`  Avg loss:            $${avgLoss.toFixed(2)}`);
  console.log(`  Average R:           ${avgR >= 0 ? '+' : ''}${avgR.toFixed(4)}`);
  console.log(`  Profit factor:       ${profitFactor}`);
  console.log(`  Starting equity:     $${startingEquity.toLocaleString()}`);
  console.log(`  Ending equity:       $${equity.toLocaleString()}`);
  console.log(`  Total P&L:           ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
  console.log(`  Return:              ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`);
  console.log(`  Max drawdown:        ${maxDrawdown.toFixed(2)}%`);
  console.log(`  Peak equity:         $${peak.toLocaleString()}`);

  // By setup type breakdown
  const bySetup = new Map<string, { count: number; pnl: number; cumR: number; wins: number }>();
  for (const t of tradeLog) {
    const entry = bySetup.get(t.setupType) || { count: 0, pnl: 0, cumR: 0, wins: 0 };
    entry.count++;
    entry.pnl = round(entry.pnl + t.dollarPnl, 2);
    entry.cumR = round(entry.cumR + t.realizedR, 4);
    if (t.dollarPnl > 0) entry.wins++;
    bySetup.set(t.setupType, entry);
  }

  console.log('\n=== By Setup Type ===');
  console.log(
    'Setup Type'.padEnd(24) +
    'Trades'.padStart(7) +
    'W/L'.padStart(7) +
    'Win%'.padStart(7) +
    'Cum R'.padStart(9) +
    'Avg R'.padStart(9) +
    '$ P&L'.padStart(12),
  );
  console.log('-'.repeat(75));
  for (const [type, stats] of Array.from(bySetup.entries()).sort((a, b) => b[1].pnl - a[1].pnl)) {
    const avgSetupR = round(stats.cumR / stats.count, 4);
    const pnlStr = stats.pnl >= 0 ? `+$${stats.pnl.toFixed(2)}` : `-$${Math.abs(stats.pnl).toFixed(2)}`;
    const wr = round((stats.wins / stats.count) * 100, 0);
    console.log(
      type.padEnd(24) +
      String(stats.count).padStart(7) +
      `${stats.wins}/${stats.count - stats.wins}`.padStart(7) +
      `${wr}%`.padStart(7) +
      `${stats.cumR >= 0 ? '+' : ''}${stats.cumR.toFixed(3)}`.padStart(9) +
      `${avgSetupR >= 0 ? '+' : ''}${avgSetupR.toFixed(3)}`.padStart(9) +
      pnlStr.padStart(12),
    );
  }

  // By outcome breakdown
  const byOutcome = new Map<string, { count: number; pnl: number }>();
  for (const t of tradeLog) {
    const entry = byOutcome.get(t.outcome) || { count: 0, pnl: 0 };
    entry.count++;
    entry.pnl = round(entry.pnl + t.dollarPnl, 2);
    byOutcome.set(t.outcome, entry);
  }

  console.log('\n=== By Outcome ===');
  console.log(
    'Outcome'.padEnd(24) +
    'Count'.padStart(7) +
    '$ P&L'.padStart(12),
  );
  console.log('-'.repeat(43));
  for (const [outcome, stats] of Array.from(byOutcome.entries()).sort((a, b) => b[1].pnl - a[1].pnl)) {
    const pnlStr = stats.pnl >= 0 ? `+$${stats.pnl.toFixed(2)}` : `-$${Math.abs(stats.pnl).toFixed(2)}`;
    console.log(
      outcome.padEnd(24) +
      String(stats.count).padStart(7) +
      pnlStr.padStart(12),
    );
  }

  console.log('');
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX Account P&L simulation failed: ${message}`);
  process.exit(1);
});
