import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Migration } from "./types";
import { _runMigrationsInternal } from "./runner";

let tmpDir: string;
let sessionsDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "aios-migrate-test-"));
  sessionsDir = path.join(tmpDir, "sessions");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeMigration(
  id: number,
  name: string,
  fn: (dir: string) => Promise<void>,
): Migration {
  return { id, name, up: fn };
}

async function readTracking(dir: string) {
  const raw = await fs.readFile(path.join(dir, ".migrations.json"), "utf-8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Core behavior
// ---------------------------------------------------------------------------

describe("migration runner", () => {
  it("no-ops when sessions/ does not exist", async () => {
    // sessionsDir not created — should return silently
    await _runMigrationsInternal(sessionsDir, [
      makeMigration(1, "should-not-run", async () => {
        throw new Error("should not run");
      }),
    ]);
  });

  it("no-ops when there are no migrations", async () => {
    await fs.mkdir(sessionsDir, { recursive: true });
    await _runMigrationsInternal(sessionsDir, []);
    // No tracking file should be created
    const files = await fs.readdir(sessionsDir);
    expect(files).not.toContain(".migrations.json");
  });

  it("runs pending migrations in order and updates tracking", async () => {
    await fs.mkdir(sessionsDir, { recursive: true });

    const order: number[] = [];

    const migrations = [
      makeMigration(2, "second", async () => {
        order.push(2);
      }),
      makeMigration(1, "first", async () => {
        order.push(1);
      }),
    ];

    await _runMigrationsInternal(sessionsDir, migrations);

    expect(order).toEqual([1, 2]);

    const state = await readTracking(sessionsDir);
    expect(state.applied).toEqual([1, 2]);
    expect(state.lastRun).toBeTruthy();
  });

  it("skips already-applied migrations", async () => {
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, ".migrations.json"),
      JSON.stringify({ applied: [1], lastRun: new Date().toISOString() }),
    );

    const ran: number[] = [];

    const migrations = [
      makeMigration(1, "already-done", async () => {
        ran.push(1);
      }),
      makeMigration(2, "pending", async () => {
        ran.push(2);
      }),
    ];

    await _runMigrationsInternal(sessionsDir, migrations);

    expect(ran).toEqual([2]);

    const state = await readTracking(sessionsDir);
    expect(state.applied).toEqual([1, 2]);
  });

  it("creates a backup before running migrations", async () => {
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(path.join(sessionsDir, "test.txt"), "hello");

    await _runMigrationsInternal(sessionsDir, [
      makeMigration(1, "trivial", async () => {}),
    ]);

    const parentFiles = await fs.readdir(tmpDir);
    const backups = parentFiles.filter((f) => f.startsWith("sessions.backup-"));
    expect(backups).toHaveLength(1);

    // Verify backup contains the original file
    const backupContent = await fs.readFile(
      path.join(tmpDir, backups[0], "test.txt"),
      "utf-8",
    );
    expect(backupContent).toBe("hello");
  });

  it("stops on failure and does not record the failed migration", async () => {
    await fs.mkdir(sessionsDir, { recursive: true });

    const ran: number[] = [];

    const migrations = [
      makeMigration(1, "ok", async () => {
        ran.push(1);
      }),
      makeMigration(2, "fails", async () => {
        throw new Error("boom");
      }),
      makeMigration(3, "should-not-run", async () => {
        ran.push(3);
      }),
    ];

    await expect(
      _runMigrationsInternal(sessionsDir, migrations),
    ).rejects.toThrow("boom");

    expect(ran).toEqual([1]);

    const state = await readTracking(sessionsDir);
    expect(state.applied).toEqual([1]);
  });

  it("migration receives sessionsDir and can modify files", async () => {
    const workspaceDir = path.join(sessionsDir, "my-workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, "data.txt"), "old");

    await _runMigrationsInternal(sessionsDir, [
      makeMigration(1, "transform", async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
          const filePath = path.join(dir, entry.name, "data.txt");
          const content = await fs.readFile(filePath, "utf-8");
          await fs.writeFile(filePath, content.replace("old", "new"));
        }
      }),
    ]);

    const result = await fs.readFile(
      path.join(workspaceDir, "data.txt"),
      "utf-8",
    );
    expect(result).toBe("new");
  });
});
