---
name: angular-bundle-guard
description: Audit Angular initial bundle size (main.js, vendor chunks, initial total) and lazy chunks, diagnose eager-loading leaks, and find opportunities to reduce bundle size. Use when asked to "check the bundle size", "how to reduce the bundle size", "how about lazy chunks", when main.js or a vendor chunk grows, when checking for bundle leaks, or when evaluating injectAsync vs. inject, barrel files (index.ts), @defer boundaries, or resource() vendor overhead.
---

# Angular Bundle Guard

Begin your response with `🛡️ **[angular-bundle-guard]**` so the user knows this skill is active.

## Process

### 1. Resolve target project, ask permission, and run the bundle analyzer script once

1. **Resolve Target Project & Ask Permission First (Single-Pass Workflow)**:
   - Check `angular.json` for `"projectType": "application"` entries:
     - **Simple App (1 application project)**: Select it automatically.
     - **Monorepo (2+ application projects)**: If the user did not specify a valid application project name, ask the user to choose from the applications in `angular.json`.
   - Ask the user for permission to run the bundle audit and generate `<tmpdir>/bundle-audit-report-<hash>.html` (in a monorepo, combine project selection and permission into one prompt). Stop immediately if the user declines.
2. **Execute the Analyzer Script Once (When Approved)**:
   - Run `node <skill-dir>/scripts/analyze-bundle.mjs [project-name]` from the target Angular workspace root, where `<skill-dir>` is the directory containing this `SKILL.md` file (see [`scripts/analyze-bundle.mjs`](./scripts/analyze-bundle.mjs); pass `--rebuild` only to force a fresh `ng build`). The script automatically reuses `<tmpdir>/bundle-audit-report-<hash>.html` when source files haven't changed, or builds, writes the full HTML report, and prints a bounded summary to stdout.
3. **Record Current & Previous Build Sizes**:
   - Record current `main.js`, initial vendor chunks (`chunk-*.js`, `polyfills.js`, `styles.css`), `Initial total`, and lazy chunk count/sizes (raw and transfer).
   - Determine the **previous ("before") build size** from the first available source:
     - **Source A — User Memory / Target**: Use the size provided by the user (e.g., "`main.js` was ~132 kB").
     - **Source B — Earlier Build in Session**: Use numbers recorded earlier in the conversation.
     - **Source C — Previous Git Commit (`HEAD` or `main`)**: Measure via a temporary detached worktree (`git worktree add --detach /tmp/bundle-before HEAD`, copy any gitignored generated config files like `public/*.json` or run `npm run prebuild` if present, run `analyze-bundle.mjs`, then `git worktree remove --force /tmp/bundle-before`) or ask the user for their expected baseline.

### 2. Classify the change

Compare current initial sizes against the previous build size:

- **Decrease** (`after < before`): Celebrate the reduction, report the exact kB saved on `main.js` and `Initial total`, and explain what unlocked it. Stop here unless asked to reduce further or audit lazy chunks.
- **No change** (`after === before`): Confirm `0 B` delta on `main.js` and verify lazy chunks absorbed any new lazy code. Stop here unless asked to reduce further or audit lazy chunks (proceed to Step 3).
- **Increase** (`after > before`): Classify every increase before accepting the build, and proceed to Step 3:
  - **Expected increase**: Code or dependencies required on initial first paint (root shell, Home landing route, startup auth/config).
  - **Leak**: Code, services, or SDKs intended for secondary routes, `@defer` blocks, or on-demand actions that got bundled into initial chunks.

### 3. Diagnose leaks, audit lazy chunks, or find reduction opportunities

When an increase is a leak, when auditing lazy chunks, or when asked how to reduce bundle size, apply these rules:

1. **Zero-File-Read Audit Rule (Sole Source of Truth: `analyze-bundle.mjs` Stdout)**:
   - `analyze-bundle.mjs` automatically audits all **8 Initial Bundle Vectors**, all **3 Lazy Chunk Vectors**, all **4 Component CSS & Dead Class categories**, and **Leak Detection** in a single pass.
   - During the audit phase (Steps 1–4), **never call file-reading tools (`read_file`, `grep`, etc.) on any file in `src/`, `dist/`, or `<tmpdir>`**.
   - Only read [`references/audit-reference.md`](references/audit-reference.md) if `analyze-bundle.mjs` reports `⚠️` issues on a vector or after the user approves fixes in Step 4.
   - Only read `src/` files **after** the user approves the implementation plan in Step 4.
2. **Never Hide a Trade-off**:
   - When a pattern is not strictly dead code but still costs bundle bytes (for example, a global `@utility` or rule in `styles.css` unused in `.html`/`.ts` and only consumed via `@apply` inside a component `styleUrl` file), always **surface the finding with the trade-off and fix** rather than silently hiding it or telling the user to blindly delete it.

### 4. Report findings in everyday English, link the HTML report, and wait for approval

1. **Use Plain, Everyday English (No Jargon)**:
   - Across both chat responses and HTML reports, never use bundler or Angular compiler jargon (*"retention path"*, *"waterfall"*, *"hoisted"*, *"reverse chunk coupling"*, *"Vector L2"*, *"`[_nghost-%COMP%]`"*, *"ViewEncapsulation"*, *"fesm2022"*, *"stylesheet pipeline"*).
   - When explaining CSS impact on JS chunks, state the rule plainly: **anything in global `styles.css` stays in the `.css` file (`0 B` in `main.js`), whereas any component with `styleUrl` copies its CSS rules inside `main.js` and lazy `.js` chunks**.
2. **Present a Concise Report & Plan**:
   - **HTML Audit Report Link**: `[bundle-audit-report-<hash>.html](file:///<tmpdir>/bundle-audit-report-<hash>.html)`.
   - **Before vs. After Table** (or **Top Contributors Table** from `analyze-bundle.mjs` stdout).
   - **Plain-English Findings**: For each finding, state in 1–2 simple sentences: (1) **What is happening**, (2) **Why it matters** (kB impact or extra files), and (3) **Simple fix**.
   - **CSS Optimization Summary Table**: A 4-row summary table for the 4 CSS categories showing item counts, estimated byte savings, and `⚠️ Test Warning` counts, pointing to the HTML report for the itemized list.
   - **Actionable Implementation Plan**: A numbered step-by-step plan. **Do not modify files until the user approves.** After applying approved fixes, re-run `node <skill-dir>/scripts/analyze-bundle.mjs [project-name]` to verify the size reduction.
