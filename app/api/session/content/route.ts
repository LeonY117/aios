import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

function contentExt(nodeType: string | null): string {
  return nodeType === "chatWindow" ? ".json" : ".md";
}

function contentPath(sessionName: string, nodeId: string, nodeType: string | null) {
  return path.join(SESSIONS_DIR, sessionName, "content", `${nodeId}${contentExt(nodeType)}`);
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(contentPath(name, id, type), "utf-8");
    return NextResponse.json({ content });
  } catch {
    // Migration fallback: chat content may still be in a .md file
    if (type === "chatWindow") {
      try {
        const content = await fs.readFile(contentPath(name, id, null), "utf-8");
        return NextResponse.json({ content });
      } catch {
        return NextResponse.json({ content: "" });
      }
    }
    return NextResponse.json({ content: "" });
  }
}

export async function POST(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const { content } = await request.json();
  const filePath = contentPath(name, id, type);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);

  // Lazy migration: remove old .md file when chat content is saved as .json
  if (type === "chatWindow") {
    await fs.unlink(contentPath(name, id, null)).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  // Remove both possible extensions — avoids needing the node type at delete time
  const dir = path.join(SESSIONS_DIR, name, "content");
  await fs.unlink(path.join(dir, `${id}.md`)).catch(() => {});
  await fs.unlink(path.join(dir, `${id}.json`)).catch(() => {});

  return NextResponse.json({ ok: true });
}
