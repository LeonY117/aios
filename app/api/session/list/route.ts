import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export async function GET() {
  try {
    const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
    const sessions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
