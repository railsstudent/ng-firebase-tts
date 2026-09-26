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

1. **Self-Contained Components with Dedicated CSS**:
   - Each icon is encapsulated in its own `.component.ts` file with a companion `.component.css` file.
   - The stylesheet defines the host layout, dimensions, and base colors using Tailwind CSS v4 `@apply` rules on `:host` (e.g. `:host { @apply inline-flex items-center justify-center shrink-0 w-5 h-5 ...; }`).
   - The component template renders an inline `<svg class="w-full h-full" fill="currentColor" aria-hidden="true">` that inherits layout, size, and color dynamically from `:host`.
2. **Contextual State Styling via Element Selectors**:
   - Consuming components (like `VoiceSelectorComponent`) apply contextual interaction states (such as caret rotation on expand or checkmark visibility on selection) by targeting element selectors directly (e.g. `.voice-trigger[aria-expanded='true'] app-arrow-drop-down-icon`).
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

- **Component Creation Overhead**: Adding a new icon requires creating a new component and companion CSS file in `src/app/shared/ui/icons/` rather than typing a font ligature string. (Easily justified given the small number of UI icons in the application).
