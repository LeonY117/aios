import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { Bash } from "just-bash";
import fs from "fs/promises";
import path from "path";
import type { ChatMessage } from "@/types";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");
const MAX_OUTPUT_CHARS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "untitled"
  );
}

function deduplicateSlug(slug: string, used: Set<string>): string {
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let i = 2;
  while (used.has(`${slug}-${i}`)) i++;
  const deduped = `${slug}-${i}`;
  used.add(deduped);
  return deduped;
}

function formatChatAsMarkdown(
  messages: ChatMessage[],
  title: string,
  model?: string,
): string {
  const header = [`# ${title}`, model ? `**Model:** ${model}` : null, "---"]
    .filter(Boolean)
    .join("\n");

  const body = messages
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const time = m.timestamp
        ? new Date(m.timestamp).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "";
      const label = time ? `**${role}** (${time})` : `**${role}**`;
      return `${label}\n${m.content}`;
    })
    .join("\n\n");

  return `${header}\n\n${body}`;
}

function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_OUTPUT_CHARS) + `\n\n... output truncated (${text.length} chars total)`;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

type SessionNode = {
  id: string;
  type?: string;
  data: Record<string, unknown>;
};

export async function buildWorkspaceBashTool(
  sessionName: string,
  ownChatNodeId: string,
): Promise<ToolSet> {
  let sessionData: { nodes: SessionNode[] };
  try {
    const raw = await fs.readFile(
      path.join(SESSIONS_DIR, sessionName, "session.json"),
      "utf-8",
    );
    sessionData = JSON.parse(raw);
  } catch {
    // Session doesn't exist or is malformed — skip the tool
    return {};
  }

  const contentDir = path.join(SESSIONS_DIR, sessionName, "content");
  const files: Record<string, string> = {};
  const manifestLines: string[] = ["# Workspace blocks\n"];
  const usedSlugs = new Set<string>();

  // Read all content files in parallel
  const entries = await Promise.all(
    sessionData.nodes.map(async (node) => {
      let content = "";
      try {
        content = await fs.readFile(
          path.join(contentDir, `${node.id}.md`),
          "utf-8",
        );
      } catch {
        // No content file — that's fine
      }
      return { node, content };
    }),
  );

  for (const { node, content } of entries) {
    const { id, type, data } = node;
    const title = (data.title as string) || "Untitled";

    // Skip context blocks (visual containers, no content)
    if (type === "contextBlock") continue;

    const isOwnChat = id === ownChatNodeId;

    if (type === "sotCard" && content) {
      const slug = deduplicateSlug(slugify(title), usedSlugs);
      const filename = `${slug}.md`;
      files[`/workspace/${filename}`] = content;
      const sourceType = (data.sourceType as string) || "manual";
      manifestLines.push(`- **${title}** (${sourceType}) → \`${filename}\``);
    }

    if (type === "chatWindow") {
      const slug = isOwnChat
        ? "_this-conversation"
        : deduplicateSlug(slugify(title), usedSlugs);
      const filename = `${slug}.chat.md`;

      if (isOwnChat) {
        files[`/workspace/${filename}`] =
          "(This is the current conversation — you already have these messages in your context.)";
      } else if (content) {
        let messages: ChatMessage[] = [];
        try {
          messages = JSON.parse(content);
        } catch {
          // Malformed JSON — skip
          continue;
        }
        if (messages.length === 0) continue;
        files[`/workspace/${filename}`] = formatChatAsMarkdown(
          messages,
          title,
          data.modelId as string | undefined,
        );
      } else {
        continue;
      }

      const label = isOwnChat ? `${title} (this conversation)` : title;
      const source = (data.source as string) || "interactive";
      manifestLines.push(`- **${label}** (chat, ${source}) → \`${filename}\``);
    }
  }

  files["/workspace/_index.md"] = manifestLines.join("\n");

  // Create just-bash instance with in-memory filesystem
  const bash = new Bash({ files, cwd: "/workspace" });

  const workspace_bash = tool<{ command: string }, string>({
    description: `Run a bash command to explore the workspace. The workspace contains all blocks (notes, documents, conversations) from the current canvas as readable files.

Start with \`cat _index.md\` to see all available files, then use standard commands to explore:
- \`cat <file>\` — read a file
- \`grep -ri <query> .\` — search across all files
- \`head -20 <file>\` — preview the start of a file
- \`wc -l *.md\` — count lines across files

The workspace is read-only. File names are derived from block titles.`,
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      const result = await bash.exec(command);
      const output =
        result.stdout +
        (result.stderr ? `\nSTDERR: ${result.stderr}` : "") +
        (result.exitCode !== 0 ? `\nExit code: ${result.exitCode}` : "");
      return truncateOutput(output || "(no output)");
    },
  });

  return { workspace_bash };
}
