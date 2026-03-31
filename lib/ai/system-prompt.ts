/**
 * System prompt builder for AIOS chat nodes.
 *
 * The system prompt is assembled from:
 * 1. A base persona/instruction set
 * 2. Attached SOT context (injected dynamically per chat)
 */

const BASE_PROMPT = `You are a helpful AI assistant in AIOS, a context management workspace.

You have access to context that the user has explicitly attached to this conversation. This context comes from various sources — documents, notes, code, conversations, and more. Use it to give informed, specific answers.

Guidelines:
- Be concise and direct. Lead with the answer.
- When referencing attached context, cite which source you're drawing from.
- If the attached context doesn't cover what the user is asking, say so — don't guess.
- Use markdown formatting for readability.
- When using web search results, cite your sources with links.`;

export type SotContext = {
  title: string;
  content: string;
  sourceType: string;
};

// ---------------------------------------------------------------------------
// BTW quick-ask prompt — optimised for the mini-panel UX
// Draws from proven patterns: Apple Intelligence (hard length cap),
// Perplexity (ban filler/hedging), Cursor (lean prompt, no repetition).
// ---------------------------------------------------------------------------

const BTW_PROMPT = `You are a concise Q&A assistant. The user selected text and is asking a quick question about it.

Rules:
- Answer in 1–3 sentences unless the user explicitly asks for more.
- Be direct. No preamble, no hedging, no filler ("Great question!", "It's worth noting…").
- Do not repeat or paraphrase the selected text back.
- Do not apologize or add caveats.
- If you don't know, say so plainly.
- Use markdown sparingly — backticks for code, no headers. Use a list only when genuinely needed.`;

/**
 * Build the full system prompt with attached SOT context injected.
 */
export function buildSystemPrompt(attachedSots: SotContext[] = []): string {
  if (attachedSots.length === 0) {
    return BASE_PROMPT;
  }

  const contextBlocks = attachedSots
    .map(
      (sot, i) =>
        `<source index="${i + 1}" title="${sot.title}" type="${sot.sourceType}">\n${sot.content}\n</source>`
    )
    .join("\n\n");

  return `${BASE_PROMPT}

The user has attached the following context to this conversation:

<attached_context>
${contextBlocks}
</attached_context>

Use this context to inform your responses. Reference sources by their title when applicable.`;
}

/**
 * Build the system prompt for BTW quick-ask panels.
 * The selected excerpt is injected as a single context block.
 */
export function buildBtwPrompt(selectedText: string): string {
  return `${BTW_PROMPT}

<selected_text>
${selectedText}
</selected_text>`;
}
