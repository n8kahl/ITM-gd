import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { playbookUpdateSchema } from '@/lib/validation/journal-api'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates = playbookUpdateSchema.parse(body)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 })
    }

    const { id } = await params
    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('playbooks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || 'Playbook not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid playbook update payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = getSupabaseAdminClient()

    const { error } = await supabase
      .from('playbooks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
