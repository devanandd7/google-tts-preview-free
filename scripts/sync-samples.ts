import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BUCKET_NAME = 'GenBox 1';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadFile(filePath: string, storagePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      upsert: true,
      contentType: filePath.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'
    });

  if (error) {
    console.error(`❌ Error uploading ${storagePath}:`, error.message);
  } else {
    console.log(`✅ Uploaded: ${storagePath}`);
  }
}

async function walkDir(dir: string, baseDir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      await walkDir(fullPath, baseDir);
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      await uploadFile(fullPath, relativePath);
    }
  }
}

async function main() {
  const samplesDir = path.join(process.cwd(), 'public', 'samples');
  if (!fs.existsSync(samplesDir)) {
    console.error('❌ public/samples directory not found');
    return;
  }

  console.log('🚀 Starting Supabase Sync...');
  await walkDir(samplesDir, samplesDir);
  console.log('✨ Sync complete!');
}

main().catch(console.error);
