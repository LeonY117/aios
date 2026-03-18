import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export async function POST(request: Request) {
  const { oldName, newName } = await request.json();

  if (!oldName || !newName) {
    return NextResponse.json(
      { error: "Missing oldName or newName" },
      { status: 400 },
    );
  }

  const oldPath = path.join(SESSIONS_DIR, oldName);
  const newPath = path.join(SESSIONS_DIR, newName);

  try {
    await fs.rename(oldPath, newPath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}
