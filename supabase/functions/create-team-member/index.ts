import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://www.tradeinthemoney.com').split(',')

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

async function verifyAdmin(req: Request, supabase: any): Promise<{ user: any; error: string | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' }
  }

  // Check admin permission via app_metadata
  const isAdmin = user.app_metadata?.is_admin === true
  if (!isAdmin) {
    return { user: null, error: 'Forbidden: admin access required' }
  }

  return { user, error: null }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Use anon key for auth verification, service key for admin operations
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey)

    // Verify caller is an authenticated admin
    const { user: caller, error: authError } = await verifyAdmin(req, supabaseAnon)
    if (authError) {
      const status = authError.includes('Forbidden') ? 403 : 401
      return new Response(
        JSON.stringify({ error: authError }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status }
      )
    }

    const { email, password, displayName, role, phoneNumber } = await req.json()

    // Validate inputs
    if (!email || !password || !displayName) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and displayName are required' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Validate role is an allowed value
    const allowedRoles = ['agent', 'admin', 'team_lead']
    const assignedRole = allowedRoles.includes(role) ? role : 'agent'

    // Initialize Supabase Admin client with Service Role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Create auth user using Admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        role: assignedRole
      }
    })

    if (createError) {
      console.error('Auth error:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 2. Add user to team_members table
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        id: authData.user.id,
        display_name: displayName,
        role: assignedRole,
        status: 'offline',
        phone_number: phoneNumber || null
      })
      .select()
      .single()

    if (memberError) {
      // Rollback: delete the auth user if team_members insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

      console.error('Member insert error:', memberError)
      return new Response(
        JSON.stringify({ error: `Failed to add team member: ${memberError.message}` }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          displayName,
          role: assignedRole
        },
        member: memberData
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
