# 0001: Angular Service Worker & PWA Caching Strategy

- **Status**: Accepted
- **Date**: 2026-08-28

## Context

The application is deployed on web platforms and accessed by users on varying network speeds and mobile devices. Without offline caching or PWA capabilities, network interruptions break the application shell, and initial asset loading incurs unnecessary network overhead on every visit.

Furthermore, dynamic AI generation endpoints (Firebase Functions / Gemini AI) return real-time streaming audio and text payloads that must never be served stale from disk.

## Decision

We will adopt Angular's native Service Worker (`@angular/service-worker`) with a dual caching strategy and PWA manifest integration:

1. **Service Worker Provider (`provideServiceWorker`)**:
   - Enable the Service Worker conditionally via `enabled: !isDevMode()` to prevent caching stale assets during local development.
   - Use `registrationStrategy: 'registerWhenStable:30000'` to ensure service worker initialization does not block main-thread application hydration or initial startup performance.

2. **Asset Group Caching (`ngsw-config.json`)**:
   - Cache static app shell assets (HTML, CSS, JS, favicons, manifest) using `installMode: prefetch` for instant offline availability.
   - Cache secondary media and external Google Fonts using `installMode: lazy` to save bandwidth.

3. **Dynamic AI Data Exclusions (`dataGroups`)**:
   - Explicitly bypass Service Worker caching for dynamic Firebase AI/TTS network calls (network-only policy) to ensure AI responses are always generated fresh.

4. **Web App Manifest & Theme Integration**:
   - Standardize `theme_color` and `background_color` to `#0f172a` (matching `bg-slate-900`) for seamless status bar integration and splash screen rendering.
   - Include 192x192 and 512x512 maskable PNG icons for full PWA installability compliance.

5. **Lifecycle Updates (`SwUpdate`)**:
   - Subscribe to `SwUpdate.versionUpdates` to notify users when a new deployment version is ready.

## Consequences

### Positive

- Instant page loads on repeat visits due to local asset caching.

- Full offline functionality for the core UI shell.
- Installability as a native-like PWA across Android, iOS, and Desktop.
- Prevents stale AI payload bugs by excluding dynamic Firebase AI calls from the cache.

### Negative / Trade-offs

- Production builds require local static preview testing (`npm run preview`) since Service Workers are disabled in local dev mode (`isDevMode()`).

- Added maintenance of `manifest.webmanifest` and icon assets.
