import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { sessionPath, isInvalidSessionName } from "@/lib/session-path";

export async function POST(request: NextRequest) {
  const { name, archived } = await request.json();
  if (isInvalidSessionName(name)) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const filePath = sessionPath(name);

  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    data.archived = !!archived;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
