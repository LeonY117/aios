#!/usr/bin/env npx tsx
/**
 * One-time migration script for AIOS session data.
 *
 * What it does:
 *   1. Backs up the entire sessions/ directory to sessions.backup-<timestamp>/
 *   2. Renames chat content files from .md → .json (chatWindow nodes)
 *   3. Converts any HTML SOT content to markdown
 *   4. Removes orphan content files (content files with no matching node)
 *   5. Prints a health report for each workspace
 *
 * Usage:
 *   npx tsx scripts/migrate-sessions.ts            # dry-run (default)
 *   npx tsx scripts/migrate-sessions.ts --apply     # actually apply changes
 */

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SESSIONS_DIR = path.join(process.cwd(), "sessions");
const IS_HTML = /^<(?:p|h[1-6]|ul|ol|li|blockquote|pre|div)\b/i;

const dryRun = !process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}

function logAction(action: string, detail: string) {
  const prefix = dryRun ? "[dry-run]" : "[apply]";
  console.log(`  ${prefix} ${action}: ${detail}`);
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

/**
 * Convert HTML to markdown using Turndown via a quick inline invocation.
 * Falls back to stripping tags if Turndown isn't available.
 */
function htmlToMarkdown(html: string): string {
  // Use a simple regex-based conversion that handles the common Tiptap HTML output.
  // This is sufficient because Tiptap's HTML output is clean and well-structured.
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Bold / italic / underline
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<u>(.*?)<\/u>/gi, "$1"); // markdown has no underline

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "  \n");

  // Lists — simple handling
  md = md.replace(/<ul[^>]*>/gi, "\n");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<ol[^>]*>/gi, "\n");
  md = md.replace(/<\/ol>/gi, "\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Task lists
  md = md.replace(
    /<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi,
    "- [x] $1\n",
  );
  md = md.replace(
    /<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi,
    "- [ ] $1\n",
  );

  // Code blocks
  md = md.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    return content
      .split("\n")
      .map((line: string) => `> ${line}`)
      .join("\n") + "\n\n";
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Divs (treat as paragraphs)
  md = md.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n\n");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");

  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim() + "\n";

  return md;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

type MigrationStats = {
  chatRenamed: number;
  htmlConverted: number;
  orphansRemoved: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Per-session migration
// ---------------------------------------------------------------------------

async function migrateSession(
  sessionName: string,
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    chatRenamed: 0,
    htmlConverted: 0,
    orphansRemoved: 0,
    errors: [],
  };

  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  const contentDir = path.join(sessionDir, "content");

  // Read session.json
  let sessionData: SessionData;
  try {
    const raw = await fs.readFile(path.join(sessionDir, "session.json"), "utf-8");
    sessionData = JSON.parse(raw);
  } catch (e) {
    stats.errors.push(`Cannot read session.json: ${e}`);
    return stats;
  }

  if (!(await dirExists(contentDir))) {
    return stats; // No content directory — nothing to migrate
  }

  const nodeIds = new Set(sessionData.nodes.map((n) => n.id));
  const nodeTypeMap = new Map(
    sessionData.nodes.map((n) => [n.id, n.type ?? "sotCard"]),
  );

  // List all content files
  const contentFiles = await fs.readdir(contentDir);

  for (const filename of contentFiles) {
    const filePath = path.join(contentDir, filename);
    const ext = path.extname(filename);
    const nodeId = path.basename(filename, ext);

    // --- 1. Orphan detection ---
    if (!nodeIds.has(nodeId)) {
      logAction("remove orphan", `${sessionName}/content/${filename}`);
      stats.orphansRemoved++;
      if (!dryRun) {
        await fs.unlink(filePath);
      }
      continue;
    }

    const nodeType = nodeTypeMap.get(nodeId);

    // --- 2. Chat .md → .json rename ---
    if (nodeType === "chatWindow" && ext === ".md") {
      const newPath = path.join(contentDir, `${nodeId}.json`);

      // Verify the content is actually JSON
      try {
        const content = await fs.readFile(filePath, "utf-8");
        JSON.parse(content); // Validate it's valid JSON
        logAction("rename chat", `${sessionName}/content/${filename} → ${nodeId}.json`);
        stats.chatRenamed++;
        if (!dryRun) {
          await fs.rename(filePath, newPath);
        }
      } catch {
        stats.errors.push(
          `Chat file is not valid JSON: ${sessionName}/content/${filename}`,
        );
      }
      continue;
    }

    // --- 3. HTML → Markdown conversion ---
    if (nodeType === "sotCard" && ext === ".md") {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        if (IS_HTML.test(content.trim())) {
          const markdown = htmlToMarkdown(content);
          logAction("convert HTML→MD", `${sessionName}/content/${filename}`);
          stats.htmlConverted++;
          if (!dryRun) {
            await fs.writeFile(filePath, markdown);
          }
        }
      } catch (e) {
        stats.errors.push(`Failed to read/convert: ${sessionName}/content/${filename}: ${e}`);
      }
    }
  }

  // --- 4. Orphan attachments in files/ ---
  const filesDir = path.join(sessionDir, "files");
  if (await dirExists(filesDir)) {
    const attachments = await fs.readdir(filesDir);
    for (const attachment of attachments) {
      const nodeId = path.basename(attachment, path.extname(attachment));
      if (!nodeIds.has(nodeId)) {
        logAction("remove orphan attachment", `${sessionName}/files/${attachment}`);
        stats.orphansRemoved++;
        if (!dryRun) {
          await fs.unlink(path.join(filesDir, attachment));
        }
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async function healthCheck(sessionName: string): Promise<string[]> {
  const issues: string[] = [];
  const sessionDir = path.join(SESSIONS_DIR, sessionName);
  const contentDir = path.join(sessionDir, "content");

  // Check session.json exists and is valid
  let sessionData: SessionData;
  try {
    const raw = await fs.readFile(path.join(sessionDir, "session.json"), "utf-8");
    sessionData = JSON.parse(raw);
  } catch {
    issues.push("session.json is missing or invalid");
    return issues;
  }

  if (!Array.isArray(sessionData.nodes)) {
    issues.push("session.json has no nodes array");
    return issues;
  }

  if (!sessionData.viewport) {
    issues.push("session.json has no viewport");
  }

  // Check each node has a content file
  if (await dirExists(contentDir)) {
    const contentFiles = new Set(await fs.readdir(contentDir));

    for (const node of sessionData.nodes) {
      if (node.type === "contextBlock") continue; // No content expected

      const expectedExt = node.type === "chatWindow" ? ".json" : ".md";
      const expectedFile = `${node.id}${expectedExt}`;

      if (!contentFiles.has(expectedFile)) {
        // Check for legacy extension
        const legacyFile = `${node.id}.md`;
        if (node.type === "chatWindow" && contentFiles.has(legacyFile)) {
          issues.push(`${node.id} (${node.type}): still using legacy .md extension`);
        } else if (!contentFiles.has(`${node.id}.md`) && !contentFiles.has(`${node.id}.json`)) {
          issues.push(`${node.id} (${node.type ?? "sotCard"}): missing content file`);
        }
      }
    }

    // Check for orphans (post-migration)
    for (const filename of contentFiles) {
      const ext = path.extname(filename);
      const nodeId = path.basename(filename, ext);
      const nodeIds = new Set(sessionData.nodes.map((n) => n.id));
      if (!nodeIds.has(nodeId)) {
        issues.push(`orphan file: content/${filename}`);
      }
    }
  } else {
    if (sessionData.nodes.length > 0) {
      const hasContentNodes = sessionData.nodes.some(
        (n) => n.type !== "contextBlock",
      );
      if (hasContentNodes) {
        issues.push("content/ directory missing but session has nodes");
      }
    }
  }

  // Check files/ directory for orphan attachments
  const filesDir = path.join(sessionDir, "files");
  if (await dirExists(filesDir)) {
    const attachments = await fs.readdir(filesDir);
    const nodeIds = new Set(sessionData.nodes.map((n) => n.id));
    for (const attachment of attachments) {
      const nodeId = path.basename(attachment, path.extname(attachment));
      if (!nodeIds.has(nodeId)) {
        issues.push(`orphan attachment: files/${attachment}`);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("╔══════════════════════════════════════════════╗");
  log("║     AIOS Session Migration Script            ║");
  log("╚══════════════════════════════════════════════╝");
  log("");

  if (dryRun) {
    log("Mode: DRY RUN (pass --apply to make changes)");
  } else {
    log("Mode: APPLY (changes will be written)");
  }
  log("");

  if (!(await dirExists(SESSIONS_DIR))) {
    log("No sessions/ directory found. Nothing to migrate.");
    return;
  }

  // --- Step 1: Backup ---
  if (!dryRun) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupDir = path.join(process.cwd(), `sessions.backup-${timestamp}`);
    log(`Backing up sessions/ → ${path.basename(backupDir)}/`);
    execSync(`cp -a ${JSON.stringify(SESSIONS_DIR)} ${JSON.stringify(backupDir)}`);
    log("Backup complete.\n");
  }

  // --- Step 2: Migrate each session ---
  const sessions = await fs.readdir(SESSIONS_DIR);
  const totals: MigrationStats = {
    chatRenamed: 0,
    htmlConverted: 0,
    orphansRemoved: 0,
    errors: [],
  };

  for (const sessionName of sessions) {
    const sessionDir = path.join(SESSIONS_DIR, sessionName);
    if (!(await dirExists(sessionDir))) continue;

    log(`── ${sessionName} ──`);
    const stats = await migrateSession(sessionName);

    totals.chatRenamed += stats.chatRenamed;
    totals.htmlConverted += stats.htmlConverted;
    totals.orphansRemoved += stats.orphansRemoved;
    totals.errors.push(...stats.errors);

    if (
      stats.chatRenamed === 0 &&
      stats.htmlConverted === 0 &&
      stats.orphansRemoved === 0 &&
      stats.errors.length === 0
    ) {
      log("  (nothing to migrate)");
    }

    for (const err of stats.errors) {
      log(`  ⚠ ${err}`);
    }
  }

  // --- Step 3: Health check ---
  log("\n═══ Health Check ═══\n");

  let allHealthy = true;
  for (const sessionName of sessions) {
    const sessionDir = path.join(SESSIONS_DIR, sessionName);
    if (!(await dirExists(sessionDir))) continue;

    const issues = await healthCheck(sessionName);
    if (issues.length > 0) {
      allHealthy = false;
      log(`${sessionName}:`);
      for (const issue of issues) {
        log(`  ⚠ ${issue}`);
      }
    }
  }

  if (allHealthy) {
    log("All sessions healthy.");
  }

  // --- Summary ---
  log("\n═══ Summary ═══\n");
  log(`  Chat .md → .json:   ${totals.chatRenamed}`);
  log(`  HTML → Markdown:    ${totals.htmlConverted}`);
  log(`  Orphans removed:    ${totals.orphansRemoved}`);
  log(`  Errors:             ${totals.errors.length}`);

  if (dryRun && (totals.chatRenamed + totals.htmlConverted + totals.orphansRemoved) > 0) {
    log("\nRun with --apply to execute these changes.");
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
