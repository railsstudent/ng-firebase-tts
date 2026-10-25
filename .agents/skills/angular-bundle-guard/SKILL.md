---
name: angular-bundle-guard
description: Audit Angular initial bundle size (main.js, vendor chunks, initial total) and lazy chunks, diagnose eager-loading leaks, and find opportunities to reduce bundle size. Use when asked to "check the bundle size", "how to reduce the bundle size", "how about lazy chunks", when main.js or a vendor chunk grows, when checking for bundle leaks, or when evaluating injectAsync vs. inject, barrel files (index.ts), @defer boundaries, or resource() vendor overhead.
---

# Angular Bundle Guard

Begin your response with `🛡️ **[angular-bundle-guard]**` so the user knows this skill is active.

Guard initial bundle size (`main.js`, vendor/shared initial chunks, and initial total) and lazy chunks by comparing production build output against the **previous build size**, classifying every increase as expected or a **leak**, and identifying actionable ways to remove leaks or optimize lazy and initial chunks.

## Process

### 1. Resolve target project, ask permission, and run the bundle analyzer script once

1. **Resolve Target Project & Ask Permission First (Single-Pass Workflow)**:
   - Check `angular.json` for `"projectType": "application"` entries:
     - **Simple App (1 application project in `angular.json`)**: Select that project automatically.
     - **Monorepo (2+ application projects in `angular.json`)**: If the user did not specify a project name—or specified a project name that does not match a valid application in `angular.json`—ask the user to choose from the valid application projects listed in `angular.json`.
   - Before executing the script, **ask the user for permission** to run the bundle audit and generate `<tmpdir>/bundle-audit-report-<hash>.html` via `os.tmpdir()` (in a monorepo with an unspecified/invalid project name, combine project selection and permission into a single prompt).
   - **If the user declines**: Stop immediately and **do not** run `analyze-bundle.mjs`.
2. **Execute the Analyzer Script Once (When Approved)**:
   - Run `node .agents/skills/angular-bundle-guard/scripts/analyze-bundle.mjs [project-name]` (pass `--rebuild` only when forcing a fresh `npx ng build [project-name] --stats-json`).
   - At startup, the script computes an **8-char SHA-256 content hash (`<hash>`)** over the target project's `sourceRoot`, `angular.json`, and `package.json`, and checks if `path.join(os.tmpdir(), 'bundle-audit-report-<hash>.html')` already exists:
     - **If the file already exists (no changes)**: The script skips `ng build` and scanning, prints the cached summary + report path, and exits immediately.
     - **If the file does not exist (code modified or first run)**: The script ensures fresh stats, runs the JS + 8 Initial Bundle Vectors + CSS audit on the target project, writes the exhaustive itemized tables to `<tmpdir>/bundle-audit-report-<hash>.html`, and prints a bounded summary to stdout.
3. Record the current **Initial chunk files** and **Lazy chunk files** tables:
   - `main.js` (raw and estimated transfer size)
   - Initial vendor / framework chunks (`chunk-*.js`, `polyfills.js`, `styles.css`)
   - **Initial total** (raw and transfer)
   - **Lazy chunk files** list, count, and individual raw/transfer sizes
4. Determine the **previous build size ("before" numbers)** using the first available source in this order:
   - **Source A — User Memory / Target**: If the user provides the expected size from memory (e.g., "`main.js` was ~132 kB") or asks if it grew, use that number directly.
   - **Source B — Earlier Build in the Current Session**: If a build was already run earlier in the conversation before the recent edits, use those recorded numbers.
   - **Source C — Previous Git Commit (`HEAD` or `main`)**: If no "before" numbers exist in memory or the session, measure the clean commit without disturbing the working tree (e.g., `git worktree add --detach /tmp/bundle-before HEAD`, run the build or link `node_modules`, record the `Initial chunk files` table, and `git worktree remove /tmp/bundle-before`)—or ask the user what size they expect if they already have a number in mind.

**Completion criterion**: User permission is obtained before running the script, `<tmpdir>/bundle-audit-report-<hash>.html` is generated (or reused from cache) in a single pass, and "before" and "after" kB numbers for `main.js`, initial vendor chunks, and `Initial total` are side by side.

### 2. Classify the change

Compare current initial sizes against the previous build size:

- **Decrease** (`after < before`): Celebrate the reduction! Report the exact kB saved on `main.js` and `Initial total`, and explain which boundary change or dead-code removal unlocked it. Stop here unless the user also asked how to reduce the bundle size further or audit lazy chunks.
- **No change** (`after === before`): Confirm zero initial bundle regression (`0 B` delta on `main.js`) and verify lazy chunks absorbed any new lazy feature code. Stop here unless the user asked how to reduce the bundle size further or audit lazy chunks (in which case, proceed to Step 3).
- **Increase** (`after > before`): Classify whether the increase is **expected** or a **leak** before accepting the build, and proceed to Step 3:
  - **Expected increase**: Intentional new code or dependencies genuinely required on initial first paint (root shell, default/home landing route, startup auth/config).
  - **Leak**: Code, services, or third-party SDKs intended for non-landing lazy routes, `@defer` blocks, or on-demand actions that got hoisted into `main.js` or an initial chunk.

**Completion criterion**: Every byte of increase in `main.js` or initial chunks is attributed to specific modules and classified as **Expected** or **Leak** (or proactive reduction / lazy audit mode is entered when requested).

### 3. Diagnose leaks, audit lazy chunks, or find reduction opportunities

When an increase is a leak, when auditing lazy chunks, **or** when the user asks how to reduce the bundle size, read [`references/audit-reference.md`](references/audit-reference.md) for the script output terminology, the **8 Initial Bundle Vectors**, and the **4 Lazy Chunk & Component CSS Vectors**, then trace retention paths from `src/main.ts` or lazy entry points:

1. **Inspect `analyze-bundle.mjs` output and `stats.json`**:
   - Group and rank `inputs` bundled into `main-*.js`, initial vendor `chunk-*.js`, and individual lazy `chunk-*.js` by `bytesInOutput` (descending).
   - Trace the `imports` chain that pulled each heavy module into the initial or lazy chunk.
2. **Audit against the Initial & Lazy Bundle Vectors in [`references/audit-reference.md`](references/audit-reference.md)**:
   - Check the **8 Initial Bundle Vectors** (mixed barrel `index.ts`, value vs. `import type`, top-level heavy SDK import, missing/broken `@defer`, redundant nested `injectAsync()`, non-Home eager route `component:`, `app.config.ts` initializers, and static JSON vs. `resource()` vendor overhead).
   - Check the **4 Lazy Chunk & Component CSS Vectors** (bloated lazy route chunk, sequential lazy waterfall, shared lazy vendor chunk leak, and component CSS bloat / dead CSS classes / `<= 3` short static `@apply` classes).

**Completion criterion**: The exact import edge (`File A -> File B -> Module`) or CSS rule and its byte contribution are identified and cited against the vectors in [`references/audit-reference.md`](references/audit-reference.md), respecting the guardrail that the Home component stays eagerly loaded.

### 4. Report the reason, link the HTML report, list the fix/reduction plan, and wait for approval

1. **Do not modify files automatically.** Keep the chat response **concise** so the **Plan** is always clearly visible:
   - **HTML Audit Report Link**: Provide a clickable link `[bundle-audit-report-<hash>.html](file:///<tmpdir>/bundle-audit-report-<hash>.html)` to the generated (or cached) HTML report containing the Output Chunks table, the **8 Initial Bundle Vectors Audit** scorecard table, and all exhaustive itemized CSS tables with clickable file/line links and unit test warnings.
   - **Before vs. After Table** (or **Top Contributors Table** for initial/lazy chunks from `stats.json`).
   - **Verdict & Retention Path**: Expected increase, Leak, or Ranked Reduction Opportunities (preserving eager loading for the Home component and avoiding sequential network waterfalls), with the exact import chain (`File A -> File B -> Module`) and vector citation.
   - **CSS Optimization Summary Table**: In chat, present a compact 4-row summary table for the 4 CSS categories (`1. Dead / Unused CSS Classes`, `2. Short Static @apply Classes`, `3. Partial Static Splits`, and `4. Duplicate / Redundant Multi-Class @apply Rules`) showing item counts, estimated byte savings, and `⚠️ Test Warning` counts, directing the user to `<tmpdir>/bundle-audit-report-<hash>.html` for the full itemized list. Follow the guardrails in [`references/audit-reference.md`](references/audit-reference.md) (never inline global overrides from `src/styles.css`, preserve unit test selectors, and consolidate redundant multi-selector classes).
   - **Actionable Implementation Plan**: Present a numbered step-by-step plan and wait for approval.
2. **Wait for explicit user direction** before applying any fix. Once the user asks to apply a specific fix, make the surgical edits and re-run `node .agents/skills/angular-bundle-guard/scripts/analyze-bundle.mjs [project-name]` (which will detect the changed hash, rebuild, and write a new `<tmpdir>/bundle-audit-report-<new-hash>.html`) to prove the chunks decreased as expected.

**Completion criterion**: The chat response stays concise with a clickable link to `<tmpdir>/bundle-audit-report-<hash>.html`, a clear summary table, and a visible step-by-step Plan, with zero unapproved file modifications.
