import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BUCKET_NAME = 'GenBox 1';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAll() {
  console.log('Listing folders in bucket:', BUCKET_NAME);
  
  const { data: root, error: rootError } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 100 });
  if (rootError) console.error('Root error:', rootError);
  else console.log('Root contents:', root.map(f => f.name));

  const folders = ['hindi', 'english', 'videos', 'broadcasts'];
  for (const folder of folders) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, { limit: 100 });
    if (error) console.log(`Folder ${folder} not found or error.`);
    else console.log(`Contents of ${folder}:`, data.map(f => f.name));
  }
}

listAll();
