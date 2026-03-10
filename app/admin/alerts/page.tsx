import { AlertConsole } from '@/components/admin/alerts/alert-console'

export default function AdminAlertsPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-['Playfair_Display'] text-3xl text-emerald-300">Alert Console</h1>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">
          Desktop + Mobile execution workflow aligned to Emerald Standard.
        </p>
      </div>

      <AlertConsole />
    </div>
  )
}
