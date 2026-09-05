# Agent Guidelines: ng-firebase-tts

This file provides context, rules, and guidance for AI assistants working on this codebase.

> [!NOTE]
> General Angular framework-level best practices are defined in [.gemini/GEMINI.md](.gemini/GEMINI.md).

## Project Structure & Coding Style

Follow this directory layout and architectural pattern when adding new files:

- **`src/app/core/`**: Core feature logic, singleton services, guards, and startup initializers.
- **`src/app/features/`**: Feature-specific components, routing, and modules (e.g., dashboard, settings).
- **`src/app/shared/`**: Reusable components, directives, pipes, domain models, and shared utilities.
  - **Shared Interfaces**: Core shared/domain TypeScript interfaces and model files (like `Expense` or `ToastMessage`) MUST be created inside `src/app/shared/interfaces/` as separate files using the naming convention `<domain-name>.interface.ts`. Never declare interfaces inline within service or utility files.
  - **Component & Feature-Scoped Interfaces**: Interfaces that are strictly scoped to a specific component or feature-tree (like table configurations or local view states) should be organized inside an `interfaces/` subfolder located directly within that component or feature directory (e.g. `src/app/features/expense/components/history-insights/interfaces/`). Use clean absolute aliases (e.g. `@/features/expense/...`) for imports to avoid relative paths.

### Core Coding Style & Syntax Constraints

When writing or refactoring TypeScript code, you MUST adhere to the following rules:

1. **Private Backing Variables & Signals**: Always use JavaScript native `#` prefixes (e.g. `readonly #state = signal(...)`, `#engine: Engine | null = null`).
2. **Tailwind CSS v4 Component Styling**: Always prioritize Tailwind CSS v4 `@apply` utility classes over raw vanilla CSS inside component-scoped stylesheets. To compile correctly in isolation, you MUST prepend an explicit `@reference` directive pointing relatively to the global `src/styles.css` stylesheet file.
   - **Correct**:

     ```css
     @reference "../../../../../styles.css";
     .toast-container {
       @apply fixed top-6 right-6 flex flex-col;
     }
     ```

3. **Signal Localization & Stateless Parent Services**: Presentation-only variables (such as active sorting columns, sort direction, page size, current page numbers, and modal pending/open selections) must reside locally inside the presenting component or its stateless view-service helpers. They must not pollute parent data-loading services.
4. **Signal Forms (`@angular/forms/signals`) Constraint**: All forms in this repository MUST be built using Angular's modern, reactive Signal Forms (`@angular/forms/signals`). The use of legacy Reactive Forms (`FormGroup`, `FormControl`, `FormBuilder` from `@angular/forms`) or template-driven forms is strictly prohibited. This guarantees optimal performance, native reactivity, and a unified state management architecture.
5. **Unified Visual Theme & Page Shells**: All newly created pages must use the project's standardized global wrapper class (such as `.app-page-shell` or layout boundaries) and adhere strictly to the designated design tokens (colors, variables, and typography) defined in the global stylesheet. Under no circumstances should individual pages define their own localized, hardcoded background overrides or absolute `min-h-screen` height properties; instead, they must inherit the unified layout structure and respect responsive viewport boundaries.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Domain documentation layout is single-context. See `docs/agents/domain.md`.

## Documentation & MCP Research Protocols

When researching framework/platform APIs, architecture, or resolving errors:

1. **Angular Questions (`angular-cli` MCP)**:
   - Primary: Query the `angular-cli` MCP server (`search_documentation`, `get_best_practices`, `ai_tutor`) targeting the project's current major Angular version (`22`).
   - Fallback: Use web search if the MCP server is unavailable or returns no results.

2. **Firebase & Google Cloud Questions (`firebase-mcp-server`)**:
   - Primary: Query the `firebase-mcp-server` (`developerknowledge_answer_query`, `developerknowledge_search_documents`) for App Hosting, Remote Config, Firebase Security Rules, and Firebase Web SDK 12.x documentation.
   - Fallback: Use web search if the tool is unavailable or hits rate limits.

3. **General Third-Party Tools (Tailwind v4, Vitest, etc.)**:
   - Use web search directly for libraries outside the official Angular / Firebase MCP knowledge bases.

## Testing & Command Verification Loop

When editing, creating, or testing files in this repository, you MUST follow these constraints:

1. **Targeted Testing via Vitest MCP Server**:
   - During feature development and refactoring, use the `vitest` MCP server (`run_tests`) to run tests against specifically modified files or component directories (e.g. `target: "./src/app/core/services/audio-player.service.spec.ts"`).
   - Use `analyze_coverage` with `target: "<source-file-or-dir>"` to identify exact uncovered lines, functions, and branches when writing or updating tests.
   - Ensure `set_project_root` is initialized prior to running Vitest MCP operations.

2. **Defer Full-Suite Verification to End-of-Task**:
   - Do NOT run full repo-wide commands (`npm run lint`, `npm run format`, `npm test`, full `npm run test:once`, `npm run build`) recursively after every individual contiguous block edit. Gather all contiguous and related edits, apply them first, and run full validation commands EXACTLY ONCE at the end of the complete task milestone.

3. **ESLint Compliance in Spec Files**:
   - When generating or updating unit tests (`*.spec.ts`), ensure they adhere to the project's ESLint config. Avoid common violations like relative imports (always use absolute path aliases starting with `@/`) and missing curly braces. Do not use legacy reactive forms or custom test classes that expand member visibility just for testing.
