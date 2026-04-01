import path from "path";

export const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export function sessionPath(name: string) {
  return path.join(SESSIONS_DIR, name, "session.json");
}
