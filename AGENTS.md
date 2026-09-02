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

## Command Verification & Validation Loop

When editing or creating files in this repository, you MUST follow these constraints regarding command execution:

1. **Defer Verification to End-of-Task**: Do NOT run verification commands (`npm run lint`, `npm run format`, `npm test`, `npm run test:once`) recursively or after every individual contiguous block edit. This slows down the interactive developer loop. Gather all contiguous and related edits, apply them first, and run validation commands EXACTLY ONCE at the end of the complete task milestone.
2. **ESLint Compliance in Spec Files**: When generating or updating unit tests (`*.spec.ts`), ensure they adhere to the project's ESLint config. Avoid common violations like relative imports (always use absolute path aliases starting with `@/`) and missing curly braces. Do not use legacy reactive forms or custom test classes that expand member visibility just for testing.
