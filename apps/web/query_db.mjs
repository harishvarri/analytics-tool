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
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Fetch recent events
  const { data: events, error: err1 } = await supabase
    .from('analytics_events')
    .select('id, portal_id, category, name, user_id, metadata, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(15);
  if (err1) console.error("Error events:", err1);
  else console.log("Recent Events:\n", JSON.stringify(events, null, 2));

  // 2. Fetch users
  const { data: users, error: err2 } = await supabase
    .from('analytics_users')
    .select('*')
    .limit(30);
  if (err2) console.error("Error users:", err2);
  else console.log("Analytics Users:\n", JSON.stringify(users, null, 2));

  // 3. Fetch recent sessions
  const { data: sessions, error: err3 } = await supabase
    .from('analytics_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);
  if (err3) console.error("Error sessions:", err3);
  else console.log("Recent Sessions:\n", JSON.stringify(sessions, null, 2));
}

run();
