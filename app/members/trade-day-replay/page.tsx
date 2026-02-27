import { notFound } from 'next/navigation'
import { isAdminUser } from '@/lib/supabase-server'
import { TradeDayReplayShell } from './trade-day-replay-shell'

export default async function TradeDayReplayPage() {
  if (!await isAdminUser()) {
    notFound()
  }

  return <TradeDayReplayShell />
}
