import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

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
  // Query events for user 03b0c725-051b-4d02-b2b3-bab9cc3f9b79
  const { data: evs1, error: err1 } = await supabase
    .from('analytics_events')
    .select('id, portal_id, category, name, metadata, occurred_at')
    .eq('user_id', '03b0c725-051b-4d02-b2b3-bab9cc3f9b79')
    .order('occurred_at', { ascending: false })
    .limit(10);
  if (err1) console.error(err1);
  else console.log("Events for user 03b0c725:\n", JSON.stringify(evs1, null, 2));

  // Query events for user 13effa84-d013-4d31-9c4a-4bf71f920d76
  const { data: evs2, error: err2 } = await supabase
    .from('analytics_events')
    .select('id, portal_id, category, name, metadata, occurred_at')
    .eq('user_id', '13effa84-d013-4d31-9c4a-4bf71f920d76')
    .order('occurred_at', { ascending: false })
    .limit(10);
  if (err2) console.error(err2);
  else console.log("Events for user 13effa84:\n", JSON.stringify(evs2, null, 2));
}

run();
