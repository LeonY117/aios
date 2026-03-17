---
name: update-docs
description: Update CLAUDE.md files to reflect current codebase state
disable-model-invocation: true
user-invocable: true
---

Update CLAUDE.md files across the project to reflect the current state of the codebase.

## Principles
- CLAUDE.md files must be **lean and compact** — every line should earn its place
- For each line, ask: "Would removing this cause Claude to make mistakes?" If not, cut it
- Use **pointers** (file:line references) instead of copying code snippets
- Don't document what linters/formatters already enforce
- Domain-specific workflows belong in skills, not CLAUDE.md

## 1. Gather context
- Run `git diff main...HEAD --stat` to see what changed
- Read all existing CLAUDE.md files: root and subdirectories
- Read the changed files to understand what shifted

## 2. Check each CLAUDE.md for staleness
For each existing CLAUDE.md, check:
- **Structure references**: Does the documented project structure still match reality? (check with ls/glob)
- **Factual accuracy**: Are documented patterns, conventions, or instructions still correct given the changes?
- **Missing patterns**: Do the changes introduce new patterns or concepts important enough to document?

## 3. Update existing files
- Fix any outdated information
- Add new facts only if they're universally relevant and would prevent mistakes
- Remove anything redundant or no longer true
- Keep files compact — prefer terse bullet points over prose

## 4. Suggest new CLAUDE.md files
- If a subdirectory has grown complex enough to warrant its own CLAUDE.md, **suggest it but do not create it**
- Explain what the file would contain and why it's needed

## 5. Output
- List of files updated with a brief summary of what changed
- Any suggestions for new CLAUDE.md files
- If no updates needed, say so
