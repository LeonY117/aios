import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

function sessionPath(name: string) {
  return path.join(SESSIONS_DIR, name, "session.json");
}

export async function POST(request: NextRequest) {
  const { name, archived } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const filePath = sessionPath(name);

  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    data.archived = !!archived;
    data.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
