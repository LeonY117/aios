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

    let newest: { name: string; createdAt: Date } | null = null;

    for (const dir of dirs) {
      const sessionFile = path.join(SESSIONS_DIR, dir.name, "session.json");
      let createdAt: Date;
      try {
        const data = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
        createdAt = data.createdAt
          ? new Date(data.createdAt)
          : (await fs.stat(path.join(SESSIONS_DIR, dir.name))).birthtime;
      } catch {
        createdAt = (await fs.stat(path.join(SESSIONS_DIR, dir.name))).birthtime;
      }
      if (!newest || createdAt > newest.createdAt) {
        newest = { name: dir.name, createdAt };
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
