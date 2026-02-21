import { backfillHistoricalSPXSetupInstances } from '../services/spx/historicalReconstruction';
import { toEasternTime } from '../services/marketHours';

function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getLastCompletedWeekRangeET(now: Date = new Date()): { from: string; to: string } {
  const etNow = toEasternTime(now);
  const deltaToFriday = etNow.dayOfWeek >= 5
    ? etNow.dayOfWeek - 5
    : etNow.dayOfWeek + 2;
  const friday = shiftDate(etNow.dateStr, -deltaToFriday);
  const monday = shiftDate(friday, -4);
  return { from: monday, to: friday };
}

async function main() {
  const fromArg = (process.argv[2] || '').trim();
  const toArg = (process.argv[3] || '').trim();
  const defaultRange = getLastCompletedWeekRangeET();
  const from = fromArg || defaultRange.from;
  const to = toArg || defaultRange.to;

  const summary = await backfillHistoricalSPXSetupInstances({ from, to });
  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX historical setup backfill failed: ${message}`);
  process.exit(1);
});

