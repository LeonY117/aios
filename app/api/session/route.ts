import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { SESSIONS_DIR, sessionPath } from "@/lib/session-path";

const EMPTY_SESSION = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

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
  const isCreate = request.nextUrl.searchParams.get("create") === "true";
  const filePath = sessionPath(name);
  const body = await request.json();

  if (isCreate) {
    try {
      await fs.access(path.dirname(filePath));
      return NextResponse.json(
        { error: "A workspace with that name already exists" },
        { status: 409 },
      );
    } catch {
      // Directory doesn't exist — proceed with creation
    }
  }

  // Read existing metadata and merge — layout saves should never clobber
  // fields like archived, createdAt that are managed by other endpoints.
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    // File doesn't exist yet
  }

  const createdAt = body.createdAt || existing.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  // Merge: existing metadata first, then body (nodes/edges/viewport), then timestamps
  const merged = { ...existing, ...body, createdAt, updatedAt };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2));

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
