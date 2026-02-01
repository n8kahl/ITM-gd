const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMapping() {
  // Get the admin_dashboard permission ID
  const { data: perms, error: permsError } = await supabase
    .from('app_permissions')
    .select('id')
    .eq('name', 'admin_dashboard')
    .single();

  if (permsError || !perms) {
    console.log('Error getting admin_dashboard permission:', permsError?.message);
    process.exit(1);
  }

  console.log('Found admin_dashboard permission:', perms.id);

  // Create the mapping
  const { data, error } = await supabase
    .from('discord_role_permissions')
    .upsert({
      discord_role_id: '1465515598640447662',
      discord_role_name: 'ITMAdmin',
      permission_id: perms.id,
    }, {
      onConflict: 'discord_role_id,permission_id'
    })
    .select();

  if (error) {
    console.log('Error creating mapping:', error.message);
    process.exit(1);
  }

  console.log('✓ Successfully created ITMAdmin -> admin_dashboard mapping!');
  console.log('  Result:', data);

  // Verify
  const { data: verify } = await supabase
    .from('discord_role_permissions')
    .select('discord_role_id, discord_role_name, permission_id')
    .eq('discord_role_id', '1465515598640447662');

  console.log('\nVerification:');
  verify?.forEach(r => {
    console.log('  Discord Role:', r.discord_role_name, '(' + r.discord_role_id + ')');
    console.log('  Permission ID:', r.permission_id);
  });
}

createMapping().catch(console.error);
