import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzgzcqkyuaqcoosrrphq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Z3pjcWt5dWFxY29vc3JycGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjY3MDcsImV4cCI6MjA4NTE0MjcwN30.nvmXXLPZaAflW99wDxgZ2rCmNNPTQQowURwGkjt6Ou4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================
// TYPES
// ============================================

export interface Subscriber {
  id?: string
  name: string
  email: string
  phone?: string
  instagram_handle?: string
  twitter_handle?: string
  referral_source?: string
  session_id?: string
  created_at?: string
  updated_at?: string
}

export interface ContactSubmission {
  id?: string
  name: string
  email: string
  message: string
  phone?: string
  created_at?: string
}

export interface CohortApplication {
  id?: string
  contact_submission_id?: string
  name: string
  email: string
  phone?: string
  message: string
  status: 'pending' | 'approved' | 'rejected' | 'contacted'
  notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at?: string
  updated_at?: string
}

export interface PageView {
  id?: string
  session_id: string
  page_path: string
  referrer?: string
  user_agent?: string
  device_type?: string
  browser?: string
  os?: string
  screen_width?: number
  screen_height?: number
  country?: string
  city?: string
  ip_address?: string
  created_at?: string
}

export interface ClickEvent {
  id?: string
  session_id: string
  element_type: string
  element_label?: string
  element_value?: string
  page_path: string
  created_at?: string
}

export interface Session {
  id?: string
  session_id: string
  first_seen?: string
  last_seen?: string
  page_views_count?: number
  is_returning?: boolean
}

export interface ConversionEvent {
  id?: string
  session_id: string
  event_type: string
  event_value?: string
  created_at?: string
}

export interface AnalyticsSummary {
  total_page_views: number
  unique_visitors: number
  total_subscribers: number
  total_contacts: number
  total_clicks: number
  device_breakdown: Record<string, number>
}

// ============================================
// SUBSCRIBER FUNCTIONS
// ============================================

export async function addSubscriber(subscriber: Omit<Subscriber, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('subscribers')
    .insert([subscriber])
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getSubscribers(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
}

// ============================================
// CONTACT SUBMISSION FUNCTIONS
// ============================================

export async function addContactSubmission(contact: Omit<ContactSubmission, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .insert([contact])
    .select()
    .single()

  if (error) throw error

  // Notify team via Discord
  // Determine if this is a Precision Cohort application based on message content
  const isApplication = contact.message?.toLowerCase().includes('precision cohort') ||
                        contact.message?.toLowerCase().includes('annual mentorship')

  try {
    await fetch(`${supabaseUrl}/functions/v1/notify-team-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        type: isApplication ? 'application' : 'contact',
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        message: contact.message,
        source: isApplication ? 'Cohort Apply Button' : 'Contact Form',
      }),
    })
  } catch (notifyError) {
    // Don't throw - the submission was successful, notification is secondary
    console.error('Failed to send Discord notification:', notifyError)
  }

  return data
}

export async function getContactSubmissions(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
}

// ============================================
// COHORT APPLICATION FUNCTIONS
// ============================================

export async function getCohortApplications(limit = 100, offset = 0, status?: CohortApplication['status']) {
  let query = supabase
    .from('cohort_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw error
  return data as CohortApplication[]
}

export async function updateCohortApplicationStatus(
  id: string,
  status: CohortApplication['status'],
  notes?: string,
  reviewedBy?: string
) {
  const { data, error } = await supabase
    .from('cohort_applications')
    .update({
      status,
      notes: notes || null,
      reviewed_by: reviewedBy || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CohortApplication
}

// ============================================
// ANALYTICS TRACKING FUNCTIONS
// ============================================

export async function trackPageView(pageView: Omit<PageView, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('page_views')
    .insert([pageView])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function trackClick(clickEvent: Omit<ClickEvent, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('click_events')
    .insert([clickEvent])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function trackConversion(conversion: Omit<ConversionEvent, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('conversion_events')
    .insert([conversion])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function upsertSession(session: Omit<Session, 'id'>) {
  const { data, error } = await supabase
    .from('sessions')
    .upsert([session], { onConflict: 'session_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// ANALYTICS QUERY FUNCTIONS
// ============================================

export async function getAnalyticsSummary(startDate?: string, endDate?: string) {
  const { data, error } = await supabase
    .rpc('get_analytics_summary', {
      start_date: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: endDate || new Date().toISOString()
    })

  if (error) throw error
  return data as AnalyticsSummary
}

export async function getPageViews(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('page_views')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
}

export async function getClickEvents(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('click_events')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
}

export async function getDeviceBreakdown(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('page_views')
    .select('device_type')
    .gte('created_at', startDate)

  if (error) throw error

  const breakdown = data.reduce((acc: Record<string, number>, view) => {
    const device = view.device_type || 'unknown'
    acc[device] = (acc[device] || 0) + 1
    return acc
  }, {})

  return breakdown
}

export async function getBrowserBreakdown(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('page_views')
    .select('browser')
    .gte('created_at', startDate)

  if (error) throw error

  const breakdown = data.reduce((acc: Record<string, number>, view) => {
    const browser = view.browser || 'unknown'
    acc[browser] = (acc[browser] || 0) + 1
    return acc
  }, {})

  return breakdown
}
