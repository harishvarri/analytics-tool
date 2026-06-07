import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Parse .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const ids = [
    '03b0c725-051b-4d02-b2b3-bab9cc3f9b79',
    '4fccf5a2-09ab-4a0b-847e-03adac40098e',
    'bd6d8264-956f-49b2-9b60-e46045282b1f'
  ];

  const { data: users, error } = await supabase
    .from('analytics_users')
    .select('*')
    .in('id', ids);

  if (error) console.error(error);
  else console.log("Matching Users:\n", JSON.stringify(users, null, 2));

  // Let's also check if these users exist in any directory sync, or what events they sent
  const { data: events, error: err2 } = await supabase
    .from('analytics_events')
    .select('id, name, user_id, user_email, user_name, metadata')
    .in('user_id', ids)
    .limit(5);
  
  if (err2) console.error(err2);
  else console.log("Recent Events for these IDs:\n", JSON.stringify(events, null, 2));
}

run();
