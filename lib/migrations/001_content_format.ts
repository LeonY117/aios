import type { Migration } from "./types";
import fs from "fs/promises";
import path from "path";

/**
 * Migration 001: Content format cleanup
 *
 * 1. Rename chat content files from .md → .json
 * 2. Convert HTML SOT content to markdown
 * 3. Remove orphan content/files entries with no matching node
 */

const IS_HTML = /^<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div)\b/i;

type SessionNode = {
  id: string;
  type?: string;
  data: Record<string, unknown>;
};

type SessionData = {
  nodes: SessionNode[];
  edges: unknown[];
  viewport: unknown;
};

function htmlToMarkdown(html: string): string {
  let md = html;

  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<u>(.*?)<\/u>/gi, "$1");

  md = md.replace(/<br\s*\/?>/gi, "  \n");

  md = md.replace(/<ul[^>]*>/gi, "\n");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<ol[^>]*>/gi, "\n");
  md = md.replace(/<\/ol>/gi, "\n");
  md = md.replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, "- [x] $1\n");
  md = md.replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, "- [ ] $1\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  md = md.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");

  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return (
      content
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n") + "\n\n"
    );
  });

  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n\n");

  md = md.replace(/<[^>]+>/g, "");

  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");

  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim() + "\n";

  return md;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function migrateWorkspace(workspaceDir: string): Promise<void> {
  const contentDir = path.join(workspaceDir, "content");

  let sessionData: SessionData;
  try {
    const raw = await fs.readFile(
      path.join(workspaceDir, "session.json"),
      "utf-8",
    );
    sessionData = JSON.parse(raw);
  } catch {
    return; // Can't read session.json — skip this workspace
  }

  if (!(await dirExists(contentDir))) return;

  const nodeIds = new Set(sessionData.nodes.map((n) => n.id));
  const nodeTypeMap = new Map(
    sessionData.nodes.map((n) => [n.id, n.type ?? "sotCard"]),
  );

  const contentFiles = await fs.readdir(contentDir);

  for (const filename of contentFiles) {
    const filePath = path.join(contentDir, filename);
    const ext = path.extname(filename);
    const nodeId = path.basename(filename, ext);

    // Orphan detection
    if (!nodeIds.has(nodeId)) {
      await fs.unlink(filePath);
      continue;
    }

    const nodeType = nodeTypeMap.get(nodeId);

    // Chat .md → .json rename
    if (nodeType === "chatWindow" && ext === ".md") {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        JSON.parse(content); // Validate it's valid JSON
        await fs.rename(filePath, path.join(contentDir, `${nodeId}.json`));
      } catch {
        // Not valid JSON — leave it alone
      }
      continue;
    }

    // HTML → Markdown conversion
    if (nodeType === "sotCard" && ext === ".md") {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        if (IS_HTML.test(content.trim())) {
          await fs.writeFile(filePath, htmlToMarkdown(content));
        }
      } catch {
        // Read/write failed — skip
      }
    }
  }

  // Orphan attachments in files/
  const filesDir = path.join(workspaceDir, "files");
  if (await dirExists(filesDir)) {
    const attachments = await fs.readdir(filesDir);
    for (const attachment of attachments) {
      const nodeId = path.basename(attachment, path.extname(attachment));
      if (!nodeIds.has(nodeId)) {
        await fs.unlink(path.join(filesDir, attachment));
      }
    }
  }
}

export const migration: Migration = {
  id: 1,
  name: "content_format",
  async up(sessionsDir) {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      await migrateWorkspace(path.join(sessionsDir, entry.name));
    }
  },
};
