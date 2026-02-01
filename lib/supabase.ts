import { createBrowserClient } from '@supabase/ssr'

// Re-export types from centralized types_db.ts
export type {
  Subscriber,
  ContactSubmission,
  ApplicationMetadata,
  ApplicationData,
  CohortApplication,
  PageView,
  ClickEvent,
  AnalyticsSession,
  ConversionEvent,
  AnalyticsSummary,
  PricingTier,
} from './types_db'

import type {
  Subscriber,
  ContactSubmission,
  ApplicationMetadata,
  CohortApplication,
  PageView,
  ClickEvent,
  AnalyticsSession,
  ConversionEvent,
  AnalyticsSummary,
  PricingTier,
} from './types_db'

// Legacy alias for backwards compatibility
export type Session = AnalyticsSession

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
}

/**
 * Browser-side Supabase client that properly syncs sessions to cookies.
 * This is critical for middleware authentication - the middleware reads
 * session from cookies, so we must use createBrowserClient from @supabase/ssr
 * instead of createClient from @supabase/supabase-js.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

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
  // Prepare the insert data
  const insertData = {
    name: contact.name,
    email: contact.email,
    message: contact.message,
    phone: contact.phone || null,
    submission_type: contact.submission_type || 'contact',
    metadata: contact.metadata || {},
  }

  const { data, error } = await supabase
    .from('contact_submissions')
    .insert([insertData])
    .select()
    .single()

  if (error) throw error

  // Determine notification type
  const isCohortApplication = contact.submission_type === 'cohort_application'
  const isLegacyApplication = contact.message?.toLowerCase().includes('precision cohort') ||
                              contact.message?.toLowerCase().includes('annual mentorship')

  // If this is a cohort application, insert directly into cohort_applications
  // This ensures the record exists even if the Edge Function fails
  if (isCohortApplication || isLegacyApplication) {
    const { error: cohortError } = await supabase
      .from('cohort_applications')
      .insert({
        contact_submission_id: data.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone || null,
        message: contact.message,
        status: 'pending',
      })

    if (cohortError) {
      // Don't throw - log the error but continue (contact submission succeeded)
      console.error('Failed to create cohort application record:', cohortError)
    }
  }

  try {
    await fetch(`${supabaseUrl}/functions/v1/notify-team-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        type: isCohortApplication ? 'cohort_application' : (isLegacyApplication ? 'application' : 'contact'),
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        message: contact.message,
        source: isCohortApplication ? 'Application Wizard' : (isLegacyApplication ? 'Cohort Apply Button' : 'Contact Form'),
        metadata: contact.metadata,
        submission_id: data.id,
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
  // First, get applications from cohort_applications table
  let query = supabase
    .from('cohort_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: applications, error } = await query

  if (error) throw error

  // For applications with contact_submission_id, fetch the metadata
  const enrichedApplications = await Promise.all(
    (applications || []).map(async (app) => {
      if (app.contact_submission_id) {
        const { data: submission } = await supabase
          .from('contact_submissions')
          .select('metadata, submission_type')
          .eq('id', app.contact_submission_id)
          .single()

        return {
          ...app,
          metadata: submission?.metadata || null,
          submission_type: submission?.submission_type || null,
        }
      }
      return app
    })
  )

  return enrichedApplications as (CohortApplication & { metadata?: ApplicationMetadata; submission_type?: string })[]
}

// Get applications directly from contact_submissions with cohort_application type
export async function getCohortApplicationsFromSubmissions(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('submission_type', 'cohort_application')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
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

export async function upsertSession(session: Omit<AnalyticsSession, 'id'>) {
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

// ============================================
// PRICING TIER FUNCTIONS
// ============================================

export async function getPricingTiers(): Promise<PricingTier[]> {
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data as PricingTier[]
}

export async function getAllPricingTiers(): Promise<PricingTier[]> {
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data as PricingTier[]
}

export async function updatePricingTier(
  id: string,
  updates: Partial<Omit<PricingTier, 'id' | 'created_at' | 'updated_at'>>
): Promise<PricingTier> {
  const { data, error } = await supabase
    .from('pricing_tiers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as PricingTier
}
