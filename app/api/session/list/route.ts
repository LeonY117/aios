import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { SESSIONS_DIR } from "@/lib/session-path";

export const dynamic = "force-dynamic";

type SessionEntry = { name: string; createdAt: string; updatedAt: string; archived: boolean };

export async function GET() {
  try {
    const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    const sessions: SessionEntry[] = await Promise.all(
      dirs.map(async (dir) => {
        const sessionFile = path.join(SESSIONS_DIR, dir.name, "session.json");
        const stat = await fs.stat(sessionFile).catch(() => null);
        const mtime = stat?.mtime.toISOString();
        let archived = false;
        try {
          const data = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
          archived = !!data.archived;
          if (data.createdAt) {
            return {
              name: dir.name,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt ?? mtime ?? data.createdAt,
              archived,
            };
          }
        } catch {
          // session.json missing or malformed
        }
        const dirStat = await fs.stat(path.join(SESSIONS_DIR, dir.name));
        const fallback = dirStat.birthtime.toISOString();
        return { name: dir.name, createdAt: fallback, updatedAt: mtime ?? fallback, archived };
      }),
    );

    // Sort by last edit, newest first
    sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
