import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

// Sensitive keys that should be masked
const SENSITIVE_KEYS = [
  'discord_bot_token',
  'discord_client_secret',
]

const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/
const VALID_TIERS = new Set(['core', 'pro', 'executive'])

function normalizeRoleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((id) => String(id).trim()).filter(Boolean)))
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []

    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return normalizeRoleIds(parsed)
      }
      if (typeof parsed === 'string') {
        return normalizeRoleIds(parsed)
      }
    } catch {
      // fall back to CSV parser
    }

    return Array.from(new Set(trimmed.split(',').map((id) => id.trim()).filter(Boolean)))
  }

  return []
}

function normalizeRoleTierMapping(raw: unknown): { value: string | null; error?: string } {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { value: null, error: 'role_tier_mapping must be valid JSON' }
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { value: null, error: 'role_tier_mapping must be an object' }
  }

  const normalized: Record<string, string> = {}
  for (const [roleId, tierValue] of Object.entries(parsed as Record<string, unknown>)) {
    const normalizedRoleId = String(roleId).trim()
    const normalizedTier = String(tierValue || '').trim().toLowerCase()
    if (!normalizedRoleId) continue

    if (!VALID_TIERS.has(normalizedTier)) {
      return {
        value: null,
        error: `role_tier_mapping contains invalid tier '${normalizedTier}' for role '${normalizedRoleId}'`,
      }
    }

    normalized[normalizedRoleId] = normalizedTier
  }

  return { value: JSON.stringify(normalized) }
}

function normalizeSettingValue(params: {
  key: string
  value: unknown
  forCreate?: boolean
}): { value: string | null; error?: string } {
  const { key, value, forCreate } = params
  const normalizedKey = key.trim()

  if (!/^[a-z0-9_]+$/i.test(normalizedKey)) {
    return { value: null, error: 'Invalid key format' }
  }

  if (value === undefined && !forCreate) {
    return { value: null, error: 'Value is required' }
  }

  if (normalizedKey === 'discord_guild_id' || normalizedKey === 'discord_client_id') {
    const normalized = String(value || '').trim()
    if (normalized && !DISCORD_SNOWFLAKE_REGEX.test(normalized)) {
      return { value: null, error: `${normalizedKey} must be a valid Discord snowflake` }
    }
    return { value: normalized }
  }

  if (normalizedKey === 'discord_invite_url') {
    const normalized = String(value || '').trim()
    if (!normalized) return { value: '' }

    try {
      const url = new URL(normalized)
      const hostname = url.hostname.toLowerCase()
      const isDiscordHost = hostname === 'discord.gg' || hostname.endsWith('.discord.gg') || hostname === 'discord.com' || hostname.endsWith('.discord.com')
      if (!isDiscordHost) {
        return { value: null, error: 'discord_invite_url must point to discord.gg or discord.com' }
      }
      return { value: normalized }
    } catch {
      return { value: null, error: 'discord_invite_url must be a valid URL' }
    }
  }

  if (normalizedKey === 'members_required_role_ids') {
    const roleIds = normalizeRoleIds(value).filter((roleId) => DISCORD_SNOWFLAKE_REGEX.test(roleId))
    if (roleIds.length === 0) {
      return { value: null, error: 'members_required_role_ids must include at least one valid Discord role ID' }
    }
    return { value: JSON.stringify(roleIds) }
  }

  if (normalizedKey === 'members_required_role_id') {
    const normalized = String(value || '').trim()
    if (normalized && !DISCORD_SNOWFLAKE_REGEX.test(normalized)) {
      return { value: null, error: 'members_required_role_id must be a valid Discord role ID' }
    }
    return { value: normalized }
  }

  if (normalizedKey === 'role_tier_mapping') {
    return normalizeRoleTierMapping(value)
  }

  if (value === null) {
    return { value: null }
  }

  if (typeof value === 'string') {
    if (normalizedKey === 'ai_system_prompt') {
      return { value }
    }
    return { value: value.trim() }
  }

  return { value: JSON.stringify(value) }
}

// GET - Fetch all settings
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const reveal = searchParams.get('reveal') === 'true'

    const [{ data, error }, accessControlSettingsResult] = await Promise.all([
      supabase
        .from('app_settings')
        .select('*')
        .order('key', { ascending: true }),
      supabase
        .from('access_control_settings')
        .select('members_allowed_role_ids')
        .eq('singleton', true)
        .maybeSingle(),
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const canonicalMembersRoleIds = normalizeRoleIds(
      accessControlSettingsResult.data?.members_allowed_role_ids,
    )

    const appSettings = (data || []).filter((setting) => (
      setting.key !== 'members_required_role_ids'
      && setting.key !== 'members_required_role_id'
    ))

    const mergedSettings = [
      ...appSettings,
      {
        key: 'members_required_role_ids',
        value: JSON.stringify(canonicalMembersRoleIds),
        description: 'Canonical members gate roles from access_control_settings',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    // Mask sensitive values unless reveal=true
    const settings = mergedSettings.map(setting => {
      if (!reveal && SENSITIVE_KEYS.some(k => setting.key.includes(k))) {
        return {
          ...setting,
          value: setting.value ? '••••••••••••' : null,
          is_masked: true,
        }
      }
      return { ...setting, is_masked: false }
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

async function updateCanonicalMembersAllowedRoles(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  roleIds: string[]
}) {
  const { supabase, roleIds } = params

  const { error } = await supabase
    .from('access_control_settings')
    .upsert({
      singleton: true,
      members_allowed_role_ids: roleIds,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'singleton' })

  if (error) {
    throw new Error(error.message)
  }
}

async function updateCanonicalRoleTierMapping(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  rawValue: unknown
}) {
  const { supabase, rawValue } = params
  const normalized = normalizeRoleTierMapping(rawValue)
  if (normalized.error || !normalized.value) {
    throw new Error(normalized.error || 'Invalid role_tier_mapping payload')
  }

  const parsed = JSON.parse(normalized.value) as Record<string, string>
  const tierToRoleId: Record<string, string | null> = {
    core: null,
    pro: null,
    executive: null,
  }

  for (const [roleId, tier] of Object.entries(parsed)) {
    tierToRoleId[tier] = roleId
  }

  for (const [tierId, discordRoleId] of Object.entries(tierToRoleId)) {
    const { error } = await supabase
      .from('pricing_tiers')
      .update({
        discord_role_id: discordRoleId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tierId)

    if (error) {
      throw new Error(error.message)
    }
  }
}

// POST - Create new setting
export async function POST(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const normalizedKey = String(key)
    const supabase = getSupabaseAdmin()

    if (normalizedKey === 'members_required_role_ids') {
      const normalized = normalizeSettingValue({ key: normalizedKey, value, forCreate: true })
      if (normalized.error || !normalized.value) {
        return NextResponse.json({ error: normalized.error }, { status: 400 })
      }
      const roleIds = normalizeRoleIds(normalized.value)
      await updateCanonicalMembersAllowedRoles({ supabase, roleIds })
      return NextResponse.json({ success: true, data: { key: normalizedKey, value: JSON.stringify(roleIds) } })
    }

    if (normalizedKey === 'role_tier_mapping') {
      await updateCanonicalRoleTierMapping({ supabase, rawValue: value })
      return NextResponse.json({ success: true, data: { key: normalizedKey, value: JSON.stringify(value) } })
    }

    const normalized = normalizeSettingValue({ key: normalizedKey, value, forCreate: true })
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('app_settings')
      .insert({ key: normalizedKey, value: normalized.value })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Setting with this key already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: inserted })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// PATCH - Update setting value
export async function PATCH(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const normalizedKey = String(key)
    const supabase = getSupabaseAdmin()

    if (normalizedKey === 'members_required_role_ids') {
      const normalized = normalizeSettingValue({ key: normalizedKey, value })
      if (normalized.error || !normalized.value) {
        return NextResponse.json({ error: normalized.error }, { status: 400 })
      }
      const roleIds = normalizeRoleIds(normalized.value)
      await updateCanonicalMembersAllowedRoles({ supabase, roleIds })

      await logAdminActivity({
        action: 'access_control_settings_updated',
        targetType: 'access_control_settings',
        targetId: 'members_allowed_role_ids',
        details: { members_allowed_role_ids: roleIds },
      })

      return NextResponse.json({ success: true, data: { key: normalizedKey, value: JSON.stringify(roleIds) } })
    }

    if (normalizedKey === 'role_tier_mapping') {
      await updateCanonicalRoleTierMapping({ supabase, rawValue: value })

      await logAdminActivity({
        action: 'pricing_tier_role_mapping_updated',
        targetType: 'pricing_tiers',
        targetId: 'discord_role_id',
        details: { role_tier_mapping: value },
      })

      return NextResponse.json({ success: true, data: { key: normalizedKey, value } })
    }

    const normalized = normalizeSettingValue({ key: normalizedKey, value })
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, any> = {}
    if (value !== undefined) updates.value = normalized.value
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('app_settings')
      .update(updates)
      .eq('key', key)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      // Setting doesn't exist, create it
      const { data: newData, error: insertError } = await supabase
        .from('app_settings')
        .insert({ key, value: normalized.value })
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      await logAdminActivity({
        action: 'setting_updated',
        targetType: 'app_setting',
        targetId: key,
        details: {
          created: true,
          value: normalized.value,
        },
      })

      return NextResponse.json({ success: true, data: newData, created: true })
    }

    await logAdminActivity({
      action: 'setting_updated',
      targetType: 'app_setting',
      targetId: key,
      details: {
        created: false,
        value: normalized.value,
      },
    })

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// DELETE - Delete setting
export async function DELETE(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('key', key)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}
