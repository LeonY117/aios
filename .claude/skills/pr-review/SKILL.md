---
name: pr-review
description: Pre-PR reviewer
user-invocable: true
---

## 1. Gather context
  - Run `git diff origin/main...HEAD --stat` for changed files overview
  - Run `git diff origin/main...HEAD` for full diff
  - Read modified files to understand the changes

## 2. Write PR summary
Write a summary to `tmp/pr-summary-{branch_name}.md` (create file, directory already exists). If file already exists, read and see if it's outdated, and edit it if it is. In the file, include:
  - What this PR does (1-2 sentences)
  - List of changes by area. You don't need to list each individual file change, because that's hard to read and the user can check the files themselves.
  Only the summary goes in the file. The review (step 3) is presented directly to the user, not written to the file.

## 3. Review the changes
  **Security & Bugs**
  - Any vulnerabilities (injection, auth bypass, data leaks)?
  - Edge cases that could cause crashes or bad state?
  - General suspicious looking logic / wrong functions
  **Pattern consistency**
  - Does new code follow existing patterns in the codebase?
  - Are imports following convention?
  **Code health**
  - Is there now duplication that warrants refactoring?
  - Are files getting bloated with appended methods that should be extracted?
  - Look out especially for patchy code / quick fixes that bloat existing files
  - Does the PR leave any dead code or unused imports behind?
  **Other observations**
  - Anything else that needs attention

**Make sure all your suggestions are verified.** Don't leave it to the user to check that your suggestions are valid — whenever things are ambiguous, do more exploration in the codebase to find out.

## 4. Output format
  For each issue:
  - **Severity**: critical / medium / minor
  - **Effort**: quick fix / moderate / significant
  - **Suggestion**: sketch of the fix
  - For critical/medium severity issues, include a relevant code snippet from the diff to make the problem concrete
