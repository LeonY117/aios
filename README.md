# AIOS — AI Operating System

A canvas-based context management tool for LLM conversations. Think "Figma meets Claude Projects" — a 2D infinite canvas where you collect sources of truth (SOTs) from Notion, Slack, GitHub, the web, or raw text, and wire them into AI chat sessions.

## Why?

Giving LLMs the right context today is painful: manual copy-paste is slow, MCP connectors are inconsistent, and in-app AI (Notion AI, Slack AI) is siloed to one app. AIOS gives you a visual workspace where you drag SOT nodes onto chat nodes to attach context, so you always see exactly what the LLM sees.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm (comes with Node.js)

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Open `.env.local` and fill in the tokens you need. See [Environment Variables](#environment-variables) below for details on how to obtain each one.

3. **Run the development server:**

   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

## Environment Variables

All tokens are optional — you only need the ones for integrations you want to use.

| Variable | Purpose | How to get it |
|---|---|---|
| `GITHUB_TOKEN` | Pull repository content as SOT nodes | Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` or `public_repo` scope |
| `NOTION_API_TOKEN` | Pull Notion pages/databases as SOT nodes | Create an [internal integration](https://www.notion.so/my-integrations), copy the secret (starts with `ntn_`), then share your pages with the integration |
| `SLACK_BOT_TOKEN` | Pull Slack messages/channels as SOT nodes | Create a [Slack app](https://api.slack.com/apps), add bot scopes (`channels:history`, `channels:read`, `users:read`), install to your workspace, and copy the Bot User OAuth Token (starts with `xoxb-`) |

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) + [React Flow](https://reactflow.dev/) (canvas) + [Tiptap](https://tiptap.dev/) (rich text editing)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Integrations:** Notion API, Slack API, GitHub API, web article extraction
- **Persistence:** localStorage (prototype phase)

## Key Concepts

- **SOT nodes** — Sources of truth displayed on the canvas (Notion pages, Slack threads, GitHub files, raw text, web articles)
- **Chat nodes** — LLM conversation windows on the canvas
- **Drag to attach** — Drag SOTs onto chat nodes to give the LLM that context
- **Conversations as SOTs** — Completed chats become new SOT nodes, building compounding project knowledge

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
