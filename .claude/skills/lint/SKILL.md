---
name: lint
description: Run TypeScript type checking, linting, and tests
user-invocable: true
---

Run type checking, linting, and tests on the project.

## 1. TypeScript
```bash
npx tsc --noEmit
```
- Fix ALL type errors
- Re-run until clean

## 2. ESLint
```bash
npx eslint .
```
- Fix ALL errors
- Auto-fix what you can with `npx eslint . --fix` first
- Re-run until clean

## 3. Tests
```bash
npm test
```
- Fix ALL test failures
- Re-run until all tests pass

## 4. Output
- List of type errors fixed
- List of lint fixes applied
- Test results: number of tests passed/failed and fixes applied
