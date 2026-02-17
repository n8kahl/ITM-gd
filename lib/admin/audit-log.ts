import { createClient } from '@supabase/supabase-js'
import { getServerUser } from '@/lib/supabase-server'

interface LogAdminActivityInput {
  action: string
  targetType: string
  targetId?: string | null
  details?: Record<string, unknown>
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key)
}

export async function logAdminActivity(input: LogAdminActivityInput): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return

    const user = await getServerUser()
    if (!user?.id) return

    await supabaseAdmin
      .from('admin_activity_log')
      .insert({
        admin_user_id: user.id,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId || null,
        details: input.details || {},
      })
  } catch (error) {
    // Never block user actions on audit logging failures.
    console.error('Failed to write admin activity log:', error)
  }
}
