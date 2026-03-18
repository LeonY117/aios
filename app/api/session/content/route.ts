import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

function contentPath(sessionName: string, nodeId: string) {
  return path.join(SESSIONS_DIR, sessionName, "content", `${nodeId}.md`);
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(contentPath(name, id), "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "" });
  }
}

export async function POST(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const { content } = await request.json();
  const filePath = contentPath(name, id);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    await fs.unlink(contentPath(name, id));
  } catch {
    // File may not exist — that's fine
  }

  return NextResponse.json({ ok: true });
}
