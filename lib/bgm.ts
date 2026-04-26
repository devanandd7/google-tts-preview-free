import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const getValidFiles = async () => {
  if (!supabase) {
    console.warn('[BGM] Supabase client not initialized. Check env vars.');
    return [];
  }
  // The bucket name is "GenBox 1" and the folder is "bg_music"
  const { data, error } = await supabase.storage.from('GenBox 1').list('bg_music', { limit: 100 });
  if (error || !data || data.length === 0) {
    console.error('[Supabase BGM Error]', error?.message || 'No files found');
    return [];
  }
  return data.filter(file =>
    file.name !== '.emptyFolderPlaceholder' &&
    (file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg'))
  );
};

export const listAllBgMusic = async (): Promise<{name: string, url: string}[]> => {
  const files = await getValidFiles();
  if (!supabase) return [];
  
  return files.map(f => {
    const { data: urlData } = supabase!.storage.from('GenBox 1').getPublicUrl(`bg_music/${f.name}`);
    return { name: f.name, url: urlData.publicUrl };
  });
};

export const getRandomBgMusic = async (): Promise<string | null> => {
  if (!supabase) return null;
  try {
    const validFiles = await getValidFiles();
    if (validFiles.length === 0) return null;

    const randomFile = validFiles[Math.floor(Math.random() * validFiles.length)];
    // Fetch from bucket "GenBox 1" and folder "bg_music/filename"
    const { data: urlData } = supabase.storage.from('GenBox 1').getPublicUrl(`bg_music/${randomFile.name}`);

    console.log('[BGM] Selected track:', randomFile.name, '→', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[BGM Fetch Error]', err);
    return null;
  }
};
