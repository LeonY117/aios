# Migrations

Automatic, forward-only data migrations for the file-based `sessions/` directory. Runs on server startup via `instrumentation.ts` — users never run anything manually.

## Adding a migration

1. Create `lib/migrations/NNN_short_name.ts` (next sequential number)
2. Export a `Migration` object with `id`, `name`, and `up(sessionsDir)`:
   ```ts
   import type { Migration } from "./types";
   export const migration: Migration = {
     id: 2,
     name: "short_name",
     async up(sessionsDir) { /* transform files */ },
   };
   ```
3. Register it in `lib/migrations/index.ts`:
   ```ts
   import { migration as m002 } from "./002_short_name";
   export const migrations: Migration[] = [m001, m002];
   ```

## Rules

- **Forward-only** — never modify a shipped migration. Write a new one instead.
- **Idempotent** — `up()` must be safe to run on already-migrated data (check before transforming).
- **No `down`** — the runner backs up `sessions/` before migrating. That's the rollback mechanism.
- **Fail fast** — if `up()` throws, the server crashes. This is intentional: serving corrupted data is worse than downtime.
- **Track per-migration** — the runner writes to `sessions/.migrations.json` after each successful migration, so a crash mid-batch doesn't lose progress.

## How it works

`instrumentation.ts` → `runner.ts` → checks `sessions/.migrations.json` → runs pending migrations in `id` order → backs up first → updates tracking after each.

## Testing

`runner.test.ts` tests the runner with temp directories. To test a specific migration, write a test that calls its `up()` directly with fixture data.
