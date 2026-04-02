import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { SESSIONS_DIR } from "@/lib/session-path";
import { migrations } from "./index";
import type { Migration, MigrationsState } from "./types";

const TRACKING_FILE = ".migrations.json";

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

async function loadState(sessionsDir: string): Promise<MigrationsState> {
  try {
    const raw = await fs.readFile(
      path.join(sessionsDir, TRACKING_FILE),
      "utf-8",
    );
    return JSON.parse(raw) as MigrationsState;
  } catch {
    return { applied: [], lastRun: "" };
  }
}

async function saveState(
  sessionsDir: string,
  state: MigrationsState,
): Promise<void> {
  const filePath = path.join(sessionsDir, TRACKING_FILE);
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));
  await fs.rename(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPending(
  allMigrations: Migration[],
  state: MigrationsState,
): Migration[] {
  const appliedSet = new Set(state.applied);
  return allMigrations
    .filter((m) => !appliedSet.has(m.id))
    .sort((a, b) => a.id - b.id);
}

async function backupSessions(sessionsDir: string): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const backupDir = path.join(
    path.dirname(sessionsDir),
    `sessions.backup-${timestamp}`,
  );
  execSync(`cp -a ${JSON.stringify(sessionsDir)} ${JSON.stringify(backupDir)}`);
  return backupDir;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let hasRun = false;

/**
 * Internal runner — accepts sessionsDir and migrations list for testability.
 */
export async function _runMigrationsInternal(
  sessionsDir: string,
  allMigrations: Migration[],
): Promise<void> {
  if (!(await dirExists(sessionsDir))) return;

  const state = await loadState(sessionsDir);
  const pending = getPending(allMigrations, state);

  if (pending.length === 0) return;

  console.log(
    `[migrations] ${pending.length} pending migration(s) — backing up sessions/`,
  );
  const backupDir = await backupSessions(sessionsDir);
  console.log(`[migrations] backup created: ${path.basename(backupDir)}/`);

  for (const migration of pending) {
    console.log(`[migrations] running #${migration.id}: ${migration.name}`);
    try {
      await migration.up(sessionsDir);
    } catch (err) {
      console.error(
        `[migrations] FAILED #${migration.id} (${migration.name}):`,
        err,
      );
      throw err;
    }

    state.applied.push(migration.id);
    state.lastRun = new Date().toISOString();
    await saveState(sessionsDir, state);
  }

  console.log("[migrations] all migrations applied successfully");
}

/**
 * Public entry point — called from instrumentation.ts on server startup.
 */
export async function runMigrations(): Promise<void> {
  if (hasRun) return;
  hasRun = true;

  await _runMigrationsInternal(SESSIONS_DIR, migrations);
}
