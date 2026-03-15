import { headers } from 'next/headers'
import {
  evaluateMemberAccess,
} from '@/lib/access-control/evaluate-member-access'
import {
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'

export async function resolveCurrentUserAccess() {
  const e2eBypassEnabled = process.env.E2E_BYPASS_AUTH === 'true'
  const e2eBypassAllowed = process.env.NODE_ENV !== 'production' && e2eBypassEnabled

  if (e2eBypassAllowed) {
    try {
      const headerStore = await headers()
      if (headerStore.get('x-e2e-bypass-auth') === '1') {
        return {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'e2e-member@example.com',
          },
          evaluation: {
            isAdmin: true,
            hasMembersAccess: true,
          },
        }
      }
    } catch {
      // Ignore header read failures and fall through to standard auth.
    }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      evaluation: null,
    }
  }

  const serviceRoleSupabase = createServiceRoleSupabaseClient()
  if (!serviceRoleSupabase) {
    return {
      user,
      evaluation: null,
    }
  }

  return {
    user,
    evaluation: await evaluateMemberAccess(serviceRoleSupabase, { userId: user.id }),
  }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { evaluation } = await resolveCurrentUserAccess()
  return evaluation?.isAdmin === true
}

export async function requireAdminAccess() {
  const { user, evaluation } = await resolveCurrentUserAccess()

  if (!user || !evaluation?.isAdmin) {
    return {
      authorized: false,
      user: null,
      evaluation: null,
    }
  }

  return {
    authorized: true,
    user,
    evaluation,
  }
}
