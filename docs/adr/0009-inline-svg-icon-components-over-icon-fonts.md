# 0009: Standalone SVG Icon Components Over Icon Web Fonts

- **Status**: Accepted
- **Date**: 2026-09-26

## Context

The application previously relied on the `@fontsource/material-symbols-outlined` NPM package to render three UI icons (`arrow_drop_down`, `mic`, and `check`) inside the AI Voice Model Selector (`VoiceSelectorComponent`).

This architecture had several drawbacks:

1. **Network Overhead & Asset Bloat**: Required downloading a full WOFF2 web font file (`material-symbols-outlined-latin-400-normal.woff2`) and defining explicit font preload links in `index.html`.
2. **Flash of Unstyled/Invisible Text (FOIT/FOUT)**: Rendering icon ligatures via font glyphs caused brief visual layout shifts while the font file was being fetched and parsed by the browser.
3. **Build & Config Clutter**: Required build-time asset copying configuration in `angular.json`, `@font-face` definitions in `src/styles.css`, and third-party NPM dependency management.
4. **Encapsulation Friction**: Styling font ligatures across Angular emulated view encapsulation boundaries was fragile compared to standard SVG component host styling.

## Decision

We replace all icon web fonts with **standalone Angular SVG components** located in `src/app/shared/ui/icons/`:

1. **Self-Contained Components with Global `.app-icon` Host Styling**:
   - Each icon is encapsulated in its own `.component.ts` file in `src/app/shared/ui/icons/` and binds `host: { class: 'app-icon ...' }` directly in its `@Component` metadata.
   - Global rules in `src/styles.css` (`.app-icon` and `.app-icon > svg { @apply size-full; }`) standardize host layout, dimensions, and child `<svg>` sizing without needing companion `.css` files for individual icons.
   - The component template renders an inline `<svg fill="currentColor" aria-hidden="true">` (or `stroke="currentColor"`) that inherits layout, size, and color dynamically from `:host`.
2. **Contextual State Styling via Template Signal Bindings**:
   - Consuming components (such as `VoiceSelectorComponent` and `RecommendationsComponent`) apply contextual interaction states (such as caret rotation on expand or checkmark visibility on selection) via direct template bindings on the icon element (e.g. `<app-arrow-drop-down-icon [class]="popupExpanded() ? 'rotate-180 text-primary-accent' : ''" />` and `<app-check-icon [class.invisible]="!opt.selected()" />`).
3. **Complete Removal of Web Font Assets**:
   - Uninstalled `@fontsource/material-symbols-outlined`.
   - Removed font preload tags from `src/index.html`.
   - Removed `@font-face` and `.material-symbols-outlined` utility rules from `src/styles.css`.
   - Removed font copy glob from `angular.json` asset configurations.

## Consequences

### Positive

- **Zero Web Font Overhead**: Completely eliminated the WOFF2 font file download, saving initial page weight and network roundtrips.
- **Zero Layout Shift (CLS)**: Inline SVG components render synchronously and instantaneously with zero FOIT/FOUT.
- **Clean Angular Encapsulation**: Full integration with Angular's emulated view encapsulation and host element styling.
- **Dependency Minimization**: Eliminates external font packages from `package.json` and build configurations.

### Negative / Trade-offs

- **Component Creation Overhead**: Adding a new icon requires creating a standalone `.component.ts` file in `src/app/shared/ui/icons/` rather than typing a font ligature string. (Easily justified given the small number of UI icons in the application).
