import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { SESSIONS_DIR } from "@/lib/session-path";

function isInvalidName(name: string) {
  return !name || name.includes("/") || name.includes("..");
}

export async function POST(request: Request) {
  const { oldName, newName } = await request.json();

  if (isInvalidName(oldName) || isInvalidName(newName)) {
    return NextResponse.json(
      { error: "Invalid name" },
      { status: 400 },
    );
  }

  const oldPath = path.join(SESSIONS_DIR, oldName);
  const newPath = path.join(SESSIONS_DIR, newName);

  try {
    // Check if target already exists
    try {
      await fs.access(newPath);
      return NextResponse.json(
        { error: "A workspace with that name already exists" },
        { status: 409 },
      );
    } catch {
      // Target doesn't exist — proceed with rename
    }

    await fs.rename(oldPath, newPath);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}
