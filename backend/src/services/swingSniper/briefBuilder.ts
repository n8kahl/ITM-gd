import { getEconomicCalendar } from '../economic';
import { getMarketHealthSnapshot } from '../marketAnalytics';
import { analyzeIVProfile } from '../options/ivAnalysis';
import { logger } from '../../lib/logger';
import { getSwingSniperWatchlistState, listSwingSniperRecentUniverseSnapshots } from './persistence';
import type { SwingSniperBriefResponse, SwingSniperSavedThesisSnapshot, SwingSniperSignalSnapshotRecord } from './types';
import { buildEdgeState, clamp, round } from './utils';

function buildMemo(regimeLabel: string, regimeDescription: string, macroEvents: string[]): string {
  const macroFragment = macroEvents.length > 0
    ? `Nearest macro pressure points: ${macroEvents.join(', ')}.`
    : 'Macro calendar is relatively light, so single-name catalysts should matter more than usual.';

  return `Regime: ${regimeLabel}. ${regimeDescription} ${macroFragment}`;
}

function latestSnapshotBySymbol(snapshots: SwingSniperSignalSnapshotRecord[]): SwingSniperSignalSnapshotRecord[] {
  const latest = new Map<string, SwingSniperSignalSnapshotRecord>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.symbol);
    if (!current || snapshot.asOf > current.asOf) {
      latest.set(snapshot.symbol, snapshot);
    }
  }
  return Array.from(latest.values());
}

function buildBoardThemes(snapshots: SwingSniperSignalSnapshotRecord[]): SwingSniperBriefResponse['boardThemes'] {
  const latest = latestSnapshotBySymbol(snapshots);
  const themes = [
    {
      key: 'long-vol-cluster',
      label: 'Long-vol dislocations',
      match: (item: SwingSniperSignalSnapshotRecord) => item.direction === 'long_vol',
    },
    {
      key: 'short-vol-cluster',
      label: 'Short-vol premium sales',
      match: (item: SwingSniperSignalSnapshotRecord) => item.direction === 'short_vol',
    },
    {
      key: 'catalyst-dense',
      label: 'Catalyst-dense window',
      match: (item: SwingSniperSignalSnapshotRecord) => item.catalystDaysUntil != null && item.catalystDaysUntil <= 10,
    },
    {
      key: 'liquidity-deep',
      label: 'Deep-liquidity names',
      match: (item: SwingSniperSignalSnapshotRecord) => {
        const score = item.snapshot?.liquidityScore;
        return typeof score === 'number' && score >= 72;
      },
    },
  ];

  return themes
    .map((theme) => {
      const members = latest.filter(theme.match);
      const scored = members.map((member) => member.score).filter((score): score is number => score != null);
      const avgScore = scored.length > 0
        ? round(scored.reduce((sum, score) => sum + score, 0) / scored.length, 1)
        : 0;
      return {
        key: theme.key,
        label: theme.label,
        count: members.length,
        avgScore,
      };
    })
    .filter((theme) => theme.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.avgScore - left.avgScore;
    })
    .slice(0, 4);
}

function buildOutlook(input: {
  snapshots: SwingSniperSignalSnapshotRecord[];
  economicEvents: Array<{ event: string; date: string }>;
  savedTheses: SwingSniperSavedThesisSnapshot[];
}): SwingSniperBriefResponse['outlook'] {
  const latest = latestSnapshotBySymbol(input.snapshots);
  const longCount = latest.filter((item) => item.direction === 'long_vol').length;
  const shortCount = latest.filter((item) => item.direction === 'short_vol').length;

  const bias: SwingSniperBriefResponse['outlook']['bias'] = longCount >= shortCount + 2
    ? 'vol_expansion'
    : shortCount >= longCount + 2
      ? 'vol_compression'
      : 'balanced';

  const confidence = round(clamp(
    42 + (Math.abs(longCount - shortCount) * 7.5) + (Math.min(latest.length, 60) * 0.35),
    35,
    90,
  ), 1);

  const catalysts = input.economicEvents
    .slice(0, 4)
    .map((event) => `${event.event} (${event.date.slice(5)})`);

  const invalidatedCount = input.savedTheses.filter((item) => item.edgeState === 'invalidated').length;
  const narrowingCount = input.savedTheses.filter((item) => item.edgeState === 'narrowing').length;
  const riskFlags: string[] = [];

  if (invalidatedCount > 0) {
    riskFlags.push(`${invalidatedCount} saved thesis${invalidatedCount === 1 ? '' : 'es'} flagged invalidated.`);
  }
  if (narrowingCount > 0) {
    riskFlags.push(`${narrowingCount} saved thesis${narrowingCount === 1 ? '' : 'es'} drifting narrower vs save-time IV.`);
  }
  if (catalysts.length === 0) {
    riskFlags.push('Macro calendar is light, so single-name events can dominate outcomes.');
  }

  const summary = bias === 'vol_expansion'
    ? '7-14 day read favors volatility expansion if catalyst clustering remains elevated.'
    : bias === 'vol_compression'
      ? '7-14 day read favors post-event volatility compression and selective premium sales.'
      : '7-14 day read is balanced; prioritize names with cleaner IV-vs-RV gaps and tighter liquidity.';

  return {
    window: '7-14d',
    bias,
    confidence,
    summary,
    catalysts,
    riskFlags,
  };
}

export async function buildSwingSniperBrief(userId: string): Promise<SwingSniperBriefResponse> {
  const [watchlistState, marketHealth, economicEvents, recentUniverseSnapshots] = await Promise.all([
    getSwingSniperWatchlistState(userId),
    getMarketHealthSnapshot().catch(() => null),
    getEconomicCalendar(7, 'HIGH').catch(() => []),
    listSwingSniperRecentUniverseSnapshots(userId, 14, 360).catch(() => [] as SwingSniperSignalSnapshotRecord[]),
  ]);

  const enrichedSavedTheses = await Promise.all(
    watchlistState.savedTheses.slice(0, 5).map(async (saved): Promise<SwingSniperSavedThesisSnapshot> => {
      let ivRankNow: number | null = null;

      try {
        const ivProfile = await analyzeIVProfile(saved.symbol, {
          strikeRange: 12,
          maxExpirations: 3,
        });
        ivRankNow = ivProfile.ivRank.ivRank;
      } catch (error) {
        logger.warn('Swing Sniper saved thesis IV refresh failed', {
          symbol: saved.symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const edgeState = buildEdgeState(saved.direction, saved.ivRankAtSave, ivRankNow);

      return {
        symbol: saved.symbol,
        savedAt: saved.savedAt,
        score: saved.score,
        setupLabel: saved.setupLabel,
        direction: saved.direction,
        thesis: saved.thesis,
        ivRankAtSave: saved.ivRankAtSave,
        ivRankNow,
        edgeState,
        monitorNote: saved.monitorNote,
      };
    }),
  );

  const marketRegime = marketHealth?.regime ?? {
    label: 'Neutral',
    description: 'Mixed signals keep the tape balanced for now.',
    signals: ['Market analytics unavailable'],
  };

  const macroLabels = economicEvents.slice(0, 3).map((event) => `${event.event} ${event.date.slice(5)}`);
  const boardThemes = buildBoardThemes(recentUniverseSnapshots);
  const outlook = buildOutlook({
    snapshots: recentUniverseSnapshots,
    economicEvents,
    savedTheses: enrichedSavedTheses,
  });

  const actionQueue = enrichedSavedTheses.length > 0
    ? enrichedSavedTheses.slice(0, 3).map((thesis) => {
      const drift = thesis.ivRankAtSave != null && thesis.ivRankNow != null
        ? `${thesis.ivRankAtSave.toFixed(0)} -> ${thesis.ivRankNow.toFixed(0)}`
        : 'IV drift unavailable';
      return `${thesis.symbol}: ${thesis.edgeState.replace('_', ' ')} edge (${drift}).`;
    })
    : [
      'Scan the top board names and save only ideas where the IV vs RV gap is obvious.',
      'Use the catalyst density strip to separate clustered setups from slow-burn names.',
      'Do not structure a trade yet if the thesis reads balanced instead of mispriced.',
    ];

  if (boardThemes.length > 0) {
    const topTheme = boardThemes[0];
    actionQueue.unshift(`${topTheme.label}: ${topTheme.count} names currently clustering with ${topTheme.avgScore.toFixed(1)} avg score.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    regime: {
      label: marketRegime.label,
      description: marketRegime.description,
      signals: marketRegime.signals,
    },
    memo: buildMemo(marketRegime.label, marketRegime.description, macroLabels),
    boardThemes,
    outlook,
    actionQueue,
    savedTheses: enrichedSavedTheses,
  };
}
