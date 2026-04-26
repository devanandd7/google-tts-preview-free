import { NextResponse } from "next/server";
import { listAllBgMusic } from "@/lib/bgm";

export async function GET() {
  try {
    const files = await listAllBgMusic();
    return NextResponse.json({ files });
  } catch (error) {
    console.error("[BGM API Error]", error);
    return NextResponse.json({ files: [] }, { status: 500 });
  }
}
