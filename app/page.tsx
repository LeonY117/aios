import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export const dynamic = "force-dynamic";

export default async function Home() {
  // Find the most recently created workspace
  try {
    const entries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    let newest: { name: string; updatedAt: Date } | null = null;

    for (const dir of dirs) {
      const sessionFile = path.join(SESSIONS_DIR, dir.name, "session.json");
      let updatedAt: Date;
      let archived = false;
      try {
        const data = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
        archived = !!data.archived;
        const ts = data.updatedAt ?? data.createdAt;
        updatedAt = ts
          ? new Date(ts)
          : (await fs.stat(path.join(SESSIONS_DIR, dir.name))).birthtime;
      } catch {
        updatedAt = (await fs.stat(path.join(SESSIONS_DIR, dir.name))).birthtime;
      }
      if (!archived && (!newest || updatedAt > newest.updatedAt)) {
        newest = { name: dir.name, updatedAt };
      }
    }

    if (newest) {
      redirect("/" + encodeURIComponent(newest.name));
    }
  } catch {
    // sessions dir doesn't exist yet
  }

  // No workspaces exist — create a default one
  const defaultDir = path.join(SESSIONS_DIR, "Untitled");
  await fs.mkdir(defaultDir, { recursive: true });
  await fs.writeFile(
    path.join(defaultDir, "session.json"),
    JSON.stringify({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: new Date().toISOString(),
    }, null, 2),
  );
  redirect("/Untitled");
}
