import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

const EMPTY_SESSION = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

function sessionPath(name: string) {
  return path.join(SESSIONS_DIR, name, "session.json");
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const filePath = sessionPath(name);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(EMPTY_SESSION);
  }
}

export async function POST(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const filePath = sessionPath(name);
  const body = await request.json();

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const sessionDir = path.join(SESSIONS_DIR, name);

  try {
    await fs.rm(sessionDir, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
