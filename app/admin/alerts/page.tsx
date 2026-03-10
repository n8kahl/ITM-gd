import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertConsole } from '@/components/admin/alerts/alert-console'

export default function AdminAlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Alert Console</h1>
        <p className="text-sm text-white/60">
          Execute Discord trade alerts through a stateful admin workflow.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Discord Runtime Configuration</CardTitle>
          <CardDescription className="text-white/60">
            Configure bot token, guild/channel, delivery method, and connection status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/admin/alerts/settings">
              Open Settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <AlertConsole />
    </div>
  )
}
