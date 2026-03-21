import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const sessionName = formData.get("sessionName") as string | null;
  const nodeId = formData.get("nodeId") as string | null;

  if (!file || !sessionName || !nodeId) {
    return NextResponse.json(
      { error: "Missing file, sessionName, or nodeId" },
      { status: 400 },
    );
  }

  const ext = path.extname(file.name).toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, "");

  if (ext === ".txt" || ext === ".md") {
    const text = await file.text();
    return NextResponse.json({
      title,
      content: text,
      sourceType: "file",
    });
  }

  if (ext === ".pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save original PDF for preview
    const filesDir = path.join(SESSIONS_DIR, sessionName, "files");
    await fs.mkdir(filesDir, { recursive: true });
    await fs.writeFile(path.join(filesDir, `${nodeId}.pdf`), buffer);

    // Extract text
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return NextResponse.json({
      title,
      content: result.text,
      sourceType: "pdf",
    });
  }

  return NextResponse.json(
    { error: `Unsupported file type: ${ext}` },
    { status: 400 },
  );
}
