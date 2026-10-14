# Coding Standards & Architectural Invariants

> [!NOTE]
> General Angular framework-level best practices are defined in [../../.gemini/GEMINI.md](../../.gemini/GEMINI.md). Repository invariants below take precedence.

This document outlines project-specific coding standards and architectural conventions for `ng-firebase-tts`.

## 1. Import Rules & Interface Organization

- **Sibling Relative Imports (`./`)**: Allowed and preferred for files within the same directory or child subdirectories.
- **Absolute Path Aliases (`@/`)**: Required for cross-directory imports.
- **Parent Relative Imports (`../`)**: Strictly forbidden in all TypeScript files (`no-restricted-imports`).
- **CSS Exception**: Component CSS files MUST use relative paths for `@reference` directives (e.g. `@reference "../../../../../styles.css";`), as CSS does not support TypeScript path aliases.
- **Shared Interfaces**: Core shared/domain TypeScript interfaces MUST be created in `src/app/shared/interfaces/` named `<domain-name>.interface.ts`. Never declare interfaces inline within service or utility files.
- **Component & Feature-Scoped Interfaces**: Interfaces strictly scoped to a specific component or feature-tree belong inside an `interfaces/` subfolder directly within that directory (e.g. `src/app/features/expense/components/history-insights/interfaces/`). Parent directory traversal imports (`../`) are strictly forbidden.

## 2. Encapsulation & Private Members

- **Private Methods**: Always declare class-internal helper methods with the TypeScript `private` keyword (`private clamp(...)`). Do NOT use `#` prefixes for methods, and do NOT leave internal helper functions as loose module-level functions in service files.
- **State & Injected Dependencies**: Always use JavaScript native `#` prefixes for all non-method private members (state signals, injected dependencies, primitive variables, objects e.g. `readonly #state = signal(...)`, `readonly #nav = inject(NavService)`). Signal queries (`viewChild`, `viewChildren`) and template-accessible properties are public by design.

## 3. Angular Reactivity & Signal Forms

- **Signal Forms Exclusively**: All forms MUST be built using Angular's modern, reactive Signal Forms (`@angular/forms/signals`). Legacy reactive forms (`FormGroup`, `FormControl`, `FormBuilder`) and template-driven forms are strictly forbidden.
- **Signal Localization & Stateless Parent Services**: Presentation-only state (active sorting columns, sort direction, page size, current page numbers, modal pending/open selections) must reside locally inside the presenting component or stateless view helpers.
- **Atomic Record Migration**: When upgrading a service to an atomic snapshot Signal (e.g. `activeAudio = signal<GeneratedAudioRecord | undefined>`), eliminate single-property pass-through getters (`audioUrl`) from the service. Project properties locally in consuming components (`audioUrl = computed(() => this.speechService.activeAudio()?.url)`).

## 4. Tailwind CSS v4 & Styling

- **Component Styles**: Prioritize Tailwind CSS v4 `@apply` utility classes over raw vanilla CSS inside component stylesheets.
- **Explicit Reference**: Prepend an explicit `@reference` directive pointing relatively to `src/styles.css` (e.g. `@reference "../../../../../styles.css";`).
- **Design Tokens**: Inspect `@theme` in `src/styles.css` for existing tokens (e.g. `text-(--color-text-secondary)`) instead of hardcoding raw palette classes.
- **Unified Page Shells**: All pages must use the project's standardized global wrapper class (`.app-page-shell`) and inherit layout boundaries without localized background overrides or `min-h-screen`.

## 5. UI Icons & Static Asset Optimization

- **Zero-Dependency Icons**: UI icons MUST be standalone SVG components under `src/app/shared/ui/icons/` referencing `styleUrl: './icon.css'` (`:host { @apply app-icon; }`) with `<svg class="w-full h-full" fill="currentColor" aria-hidden="true">`. Do not install icon font packages.
- **External Dependencies**: Prefer native Angular/TypeScript primitives over third-party utility packages.
- **PWA Icon Dimensions**: PWA icons in `public/icons/` must strictly match designated physical pixel dimensions (192x192 for `icon-192.png`, 512x512 for `icon-512.png`). Downscale raw assets before committing.

## 6. Domain Package Boundaries & Invariants

- **Domain Packages (`src/app/core/<domain>/`)**: Cohesive flat domain packages (e.g. `src/app/core/vision/`, `src/app/core/speech/`, `src/app/core/auth/`). Keep all domain files at the root level of the folder without nested subdirectories (`constants/`, `interfaces/`, `types/`). Each domain presents a clean public API via `index.ts`. Never export internal helpers for testing.
- **Barrel File Restrictions**: Barrel files (`index.ts`) are strictly reserved for core domain packages under `src/app/core/<domain>/`. Never create barrel files in `src/app/pwa/`, feature folders, or component directories containing `@defer` components.

## 6. Asynchronous & Fire-and-Forget Operations

- **Floating Promises Handling**: At caller sites requiring non-blocking / fire-and-forget execution, handle the returned Promise with `.catch(...)` to satisfy `@typescript-eslint/no-floating-promises`.
- **Ban `void` Operator Keyword**: Never use the `void` expression operator keyword (e.g. `void this.method()`) at call sites.

## 7. Deferred Component Empty State Invariant

- **One-Way Hydration & Empty State Invariant**: Angular `@defer (when condition)` triggers hydration once and never reverts to `@placeholder` if data becomes falsy or is cleared post-hydration. While the parent `@placeholder` handles initial FCP/CLS, every deferred child component rendering nullable or dynamic models MUST maintain an internal `@empty` or `@else` fallback state to safely handle data resets.

## 8. Architectural Layer Hierarchy & Boundary Invariants

The codebase enforces a strict Directed Acyclic Graph (DAG) layer hierarchy via deterministic ESLint `no-restricted-imports` rules:

$$\text{Features} \longrightarrow \text{Shared} \longrightarrow \text{Core}$$

- **Core Layer (`src/app/core/<domain>/`)**: Pure business logic, services, and models. Zero dependencies on `shared` or `features`.
- **Shared Layer (`src/app/shared/`)**: Reusable UI components, pipes, directives, icons, and styles. Zero dependencies on `features`.
- **Feature Layer (`src/app/features/<feature>/`)**: Route-level and feature-specific components and view models. Features may depend on `core` and `shared`, but direct cross-feature imports between sibling features are strictly forbidden.
- **Companion Skeletons**: Loading and placeholder skeletons must always reside in the exact same layer as their primary component (e.g. shared component skeletons reside in `src/app/shared/ui/components/`, feature skeletons in `src/app/features/<feature>/`).

## 9. Micro-Library Capability Audits & Fallbacks

- **Typing Verification**: Before proposing external `@types/*` dependencies, verify whether the target package already ships built-in TypeScript declarations.
- **Micro-Library Boundaries**: When selecting lightweight parsers over full-featured engines (e.g. `snarkdown` for bundle isolation), audit syntax limitations upfront and implement a two-tier defense:
  1. **Prompt Guardrail**: Direct the model explicitly against unsupported syntax (e.g., "Use bulleted lists; never output tables").
  2. **Client Fallback Normalizer**: Provide defensive client-side parsing/transformation to normalize non-conforming content before passing it to the micro-library.
