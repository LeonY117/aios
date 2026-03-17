# AIOS — AI Operating System

## What is this?

A canvas-based context management tool for LLM conversations. Think "Figma meets Claude Projects" — a 2D canvas where you collect sources of truth (SOTs) and wire them into AI chat sessions.

## Problem

Giving LLMs the right context today is painful:
1. **Manual copy-paste** into ChatGPT/Claude — reliable but slow
2. **MCP connectors** — inconsistent results, slow
3. **In-app AI** (Notion AI, Slack AI) — siloed to one app's context

## Solution

A per-project infinite canvas where:
- **SOT nodes** display content pulled from Notion, Slack, Granola, repos, or raw text
- **Chat nodes** are LLM conversation windows (Claude, GPT, etc.)
- Users **drag SOTs onto chats** to attach context, giving full visual control over what the LLM sees
- Completed conversations become **new SOT nodes**, creating compounding project knowledge

## Key design principles

- Visual transparency: you always see exactly what context the LLM has
- Context budget: show token usage so users understand limits
- Start simple: raw text SOTs first, integrations later
- Conversations are first-class SOTs

## Tech stack

- **Frontend:** Next.js + React Flow (canvas)
- **LLM integration:** Claude API (primary), extensible to others
- **Persistence:** localStorage for prototype, database later
- **Integrations:** Notion API, Slack API (v1+)

## Development conventions

Use project `tmp/` for temporary files, DO NOT use system tmp folder `/tmp`.
Use `local/` for manual test files and ad-hoc experiments.