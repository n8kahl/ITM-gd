const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('=== Checking app_settings ===');

  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['discord_bot_token', 'discord_guild_id']);

  if (settingsError) {
    console.log('Error:', settingsError.message);
  } else if (settings) {
    settings.forEach(s => {
      const status = !s.value ? '❌ EMPTY' : '✓ Set (' + s.value.substring(0, 10) + '...)';
      console.log('  ' + s.key + ': ' + status);
    });
  }

  if (!settings?.find(s => s.key === 'discord_bot_token')) {
    console.log('  discord_bot_token: ❌ MISSING');
  }
  if (!settings?.find(s => s.key === 'discord_guild_id')) {
    console.log('  discord_guild_id: ❌ MISSING');
  }

  console.log('');
  console.log('=== Checking admin_dashboard permission ===');
  const { data: perms, error: permsError } = await supabase
    .from('app_permissions')
    .select('id, name')
    .eq('name', 'admin_dashboard');

  if (permsError) {
    console.log('Error:', permsError.message);
  } else if (perms?.length) {
    console.log('  admin_dashboard: ✓ Exists (id: ' + perms[0].id + ')');
  } else {
    console.log('  admin_dashboard: ❌ MISSING');
  }

  console.log('');
  console.log('=== Checking ITMAdmin role mapping ===');
  const { data: roleMap, error: roleError } = await supabase
    .from('discord_role_permissions')
    .select('discord_role_id, discord_role_name, permission_id')
    .eq('discord_role_id', '1465515598640447662');

  if (roleError) {
    console.log('Error:', roleError.message);
  } else if (roleMap?.length) {
    console.log('  ITMAdmin mapping: ✓ Exists');
    roleMap.forEach(r => console.log('    -> ' + r.discord_role_name + ' -> permission: ' + r.permission_id));
  } else {
    console.log('  ITMAdmin mapping: ❌ MISSING');
  }
}

check().catch(console.error);
