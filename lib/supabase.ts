import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzgzcqkyuaqcoosrrphq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Z3pjcWt5dWFxY29vc3JycGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjY3MDcsImV4cCI6MjA4NTE0MjcwN30.nvmXXLPZaAflW99wDxgZ2rCmNNPTQQowURwGkjt6Ou4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type for subscriber data
export interface Subscriber {
  id?: string
  name: string
  email: string
  phone?: string
  instagram_handle?: string
  created_at?: string
}

// Function to add a new subscriber
export async function addSubscriber(subscriber: Omit<Subscriber, 'id' | 'created_at'>) {
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
