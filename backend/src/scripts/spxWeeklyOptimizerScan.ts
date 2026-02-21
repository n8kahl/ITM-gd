import { getActiveSPXOptimizationProfile, runSPXOptimizerScan } from '../services/spx/optimizer';
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
  const profile = await getActiveSPXOptimizationProfile();
  const week = getLastCompletedWeekRangeET();
  const historyDays = profile.walkForward.trainingDays + profile.walkForward.validationDays - 1;
  const scanFrom = shiftDate(week.to, -historyDays);

  const result = await runSPXOptimizerScan({
    from: scanFrom,
    to: week.to,
    mode: 'weekly_auto',
  });

  console.log(JSON.stringify({
    week,
    scanRange: { from: scanFrom, to: week.to },
    profileMode: 'weekly_auto',
    result,
  }, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX weekly optimizer scan failed: ${message}`);
  process.exit(1);
});
