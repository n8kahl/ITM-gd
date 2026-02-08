import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ai_coach_users')
      .select('count')
      .limit(1);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
