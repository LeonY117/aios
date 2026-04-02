export type Migration = {
  /** Unique numeric ID — must be sequential, no gaps. */
  id: number;
  /** Human-readable name, used in logs and the tracking file. */
  name: string;
  /** The migration logic. Receives the absolute path to sessions/. */
  up: (sessionsDir: string) => Promise<void>;
};

export type MigrationsState = {
  /** IDs of migrations that have been applied, in order. */
  applied: number[];
  /** ISO timestamp of last migration run. */
  lastRun: string;
};
