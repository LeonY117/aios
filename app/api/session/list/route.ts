import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

type SessionEntry = { name: string; createdAt: string };

export async function GET() {
  try {
    const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    const sessions: SessionEntry[] = await Promise.all(
      dirs.map(async (dir) => {
        const sessionFile = path.join(SESSIONS_DIR, dir.name, "session.json");
        try {
          const data = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
          if (data.createdAt) {
            return { name: dir.name, createdAt: data.createdAt };
          }
        } catch {
          // session.json missing or malformed
        }
        // Fallback: use directory birthtime for sessions without createdAt
        const stat = await fs.stat(path.join(SESSIONS_DIR, dir.name));
        return { name: dir.name, createdAt: stat.birthtime.toISOString() };
      }),
    );

    // Sort by creation date, newest first
    sessions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
