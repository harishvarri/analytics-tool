import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';

// Load env from apps/web/.env.local
dotenv.config({ path: path.join(process.cwd(), 'apps', 'web', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Fetch recent events
  const { data: events, error: err1 } = await supabase
    .from('analytics_events')
    .select('id, portal_id, category, name, user_id, metadata, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(10);
  if (err1) console.error("Error events:", err1);
  else console.log("Recent Events:\n", JSON.stringify(events, null, 2));

  // 2. Fetch users
  const { data: users, error: err2 } = await supabase
    .from('analytics_users')
    .select('*')
    .limit(20);
  if (err2) console.error("Error users:", err2);
  else console.log("Analytics Users:\n", JSON.stringify(users, null, 2));

  // 3. Fetch recent sessions
  const { data: sessions, error: err3 } = await supabase
    .from('analytics_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);
  if (err3) console.error("Error sessions:", err3);
  else console.log("Recent Sessions:\n", JSON.stringify(sessions, null, 2));
}

run();
