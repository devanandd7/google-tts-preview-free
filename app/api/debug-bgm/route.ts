import { NextResponse } from "next/server";
import { getRandomBgMusic, listAllBgMusic } from "@/lib/bgm";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Also try raw direct test
  let rawResult: any = null;
  if (supabaseUrl && supabaseKey) {
    const client = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await client.storage.from('GenBox 1').list('bg_music', { limit: 100 });
    rawResult = { data: data?.map(f => f.name), error: error?.message };
  }

  const all = await listAllBgMusic();
  const random = await getRandomBgMusic();

  return NextResponse.json({
    envCheck: {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      keyPrefix: supabaseKey?.slice(0, 20) + "...",
    },
    rawDirectTest: rawResult,
    totalFiles: all.length,
    files: all,
    randomPicked: random,
  });
}
