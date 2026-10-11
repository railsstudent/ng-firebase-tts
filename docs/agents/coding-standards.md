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
