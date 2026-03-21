import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

function filePath(sessionName: string, nodeId: string) {
  return path.join(SESSIONS_DIR, sessionName, "files", `${nodeId}.pdf`);
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(filePath(name, id));
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "default";
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    await fs.unlink(filePath(name, id));
  } catch {
    // File may not exist
  }

  return NextResponse.json({ ok: true });
}
