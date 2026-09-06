# Specification: Angular Service Worker & PWA Setup

**Status**: `ready-for-agent`

## Problem Statement

Users of the application on mobile devices or unstable network connections experience slow load times or complete failures when offline. Furthermore, they are unable to install the application to their home screens like a native mobile application because the codebase lacks a Web App Manifest, required PWA PNG icons, dark slate theme color configurations (`#0f172a`), iOS compatibility metadata, active Service Worker update handling, and end-to-end runtime PWA verification steps.

## Solution

Enable a fully offline-capable Progressive Web App (PWA) experience by completing the Angular Service Worker registration, adding a compliant Web App Manifest configured with dark slate theme colors (`#0f172a`), providing required PNG icons and iOS Safari meta tags, handling application updates via Angular's `SwUpdate` service, ensuring dynamic AI network requests bypass local cache, and defining clear runtime/E2E PWA verification procedures.

## User Stories

1. As an offline user, I want the application to load even when I have no internet connection, so that I can access the UI shell and previously loaded assets.
2. As a mobile device user with limited bandwidth, I want static assets (JS, CSS, HTML, and Favicon) to be cached on first load, so that I do not consume redundant cellular data.
3. As a user on a slow network, I want critical application resources to load instantly from cache, so that I experience a highly responsive user interface without page load delay.
4. As a mobile user, I want to see an "Add to Home Screen" or install prompt in my browser, so that I can add the application as a standalone launcher.
5. As an installed-app user, I want the application to run in standalone display mode with a dark slate status bar (`#0f172a`), so that it seamlessly matches the dark theme (`bg-slate-900`) and feels like a native mobile application.
6. As a user opening the installed PWA, I want the splash screen background to be dark slate (`#0f172a`), so that I do not experience a white flash during startup.
7. As an iOS Safari user, I want the application to support iOS-specific touch icons and translucent dark status bar styling, so that the PWA experience is consistent on Apple devices.
8. As an application user, I want to be notified when a new version of the app is available, so that I can refresh and access the latest features immediately.
9. As a user of the app, I want remote Google Fonts to be cached, so that typographic styling remains consistent even when I am offline.
10. As an application developer, I want the Service Worker to be disabled during local development, so that I do not run into caching issues while writing code.
11. As an application developer, I want the Service Worker registration to happen only after the application is fully stable (or after a timeout), so that initial loading performance is completely unblocked.
12. As an application developer, I want dynamic AI and TTS API network calls to bypass Service Worker caching, so that real-time AI responses are always fresh and never served stale from local cache.
13. As an active user with a long-running browser session, I want the application to periodically check for service worker updates in the background without interrupting my current task, so that I am notified as soon as a new version is deployed.
14. As a user encountering a corrupted cache or unrecoverable service worker state, I want the application to automatically perform an emergency reload, so that missing or invalid chunk hashes do not break my experience.

## Implementation Decisions

### 1. Web App Manifest, Theme Colors & PNG Icon Requirements

A Web App Manifest (`manifest.webmanifest`) will be created inside the `public/` directory. It will configure:

- The app's full name, short name, and standalone display mode.
- Theme color (`theme_color`) set to `#0f172a` matching the application's `bg-slate-900` dark theme.
- Background color (`background_color`) set to `#0f172a` to prevent white flashes during app launch.
- Standard 192x192 and 512x512 maskable PNG icons (`icon-192.png`, `icon-512.png`) inside `public/icons/` to meet Chrome/Lighthouse PWA installability requirements.

### 2. Index Template Head Registration & iOS Safari Support

The HTML index template (`src/index.html`) will be updated in its `<head>` section to include:

- `<link rel="manifest" href="manifest.webmanifest">`
- `<meta name="theme-color" content="#0f172a">`
- iOS Safari compatibility tags: `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, and `<link rel="apple-touch-icon" href="icons/icon-192.png">`.

### 3. Application Update Management & Recovery

The core update service will coordinate service worker lifecycle events and browser reload workflows:

- **Reactive Update State**: Expose reactive update availability to notify the user interface when a newly deployed application version has been downloaded and is ready for activation.
- **Background Update Checks**: Schedule non-blocking periodic update checks defaulting to 1 hour after the application achieves stability, with support for configurable injection overrides to streamline local testing.
- **Unrecoverable State Recovery**: Detect unrecoverable service worker cache failures and initiate an automatic emergency reload to purge corrupted state.
- **Safe Application Reload**: Allow users to voluntarily activate the new version and reload the page cleanly.

### 4. Dynamic Data & AI Caching Strategy (`dataGroups`)

Ensure dynamic Firebase AI, Functions, and Text-to-Speech network requests bypass Service Worker caching (network-only strategy) so that AI responses are never served stale from local disk.

### 5. Codebase Seams and Service Worker Integration

We will utilize the existing Angular Service Worker registration seam via `provideServiceWorker` in the application configuration:

- Keep the `isDevMode()` check intact to avoid caching during local development.
- Keep the registration strategy as `registerWhenStable:30000` to prevent service worker thread initialization from blocking main thread hydration/stability.

---

## Testing Decisions

### Good Test Principles

A robust test should only test **external behavior** (e.g., the presence of the manifest link, correct theme color values, build-time config inclusion, proper icon paths, update notification handling, and end-to-end PWA installability) rather than internal implementation mechanics or library-specific operators.

### 1. Build Verification

We will test that running the production build pipeline correctly generates the necessary Service Worker files in the distribution folder:

- Verification of `ngsw.json` file existence and validity.
- Verification of `ngsw-worker.js` file generation.

### 2. Template and Manifest Unit Tests

Unit tests will assert that:

- The HTML index template contains the correct `<link rel="manifest" href="manifest.webmanifest">`, theme color (`#0f172a`), and iOS Safari meta tags.
- The `manifest.webmanifest` contains `theme_color` `#0f172a`, `background_color` `#0f172a`, and required 192x192 and 512x512 icon definitions.

### 3. Update Service Unit Tests

Unit tests will assert that:

- The update service initializes in a default non-ready state and signals availability when a valid version-ready event is detected.
- Non-ready or intermediate lifecycle events are ignored without triggering update alerts.
- Non-browser (SSR) or disabled worker environments are handled gracefully without raising runtime errors.
- Periodic update checks commence only after initial application stability.
- Corrupted or unrecoverable cache states trigger automatic browser recovery.
- Triggering an update reload activates the new version and refreshes the application.

### 4. Runtime & E2E PWA Verification Procedures

Because Service Workers are disabled in development mode (`isDevMode()`), end-to-end verification must be executed against production builds:

1. **Production Preview Verification**: Execute `npm run preview` to build and serve the production bundle locally.
2. **Lighthouse PWA Audit**: Run Chrome DevTools **Lighthouse -> PWA Audit** to verify 100% installability compliance (manifest, icons, theme color, service worker registration).
3. **Offline Inspection**: Simulate Offline/Airplane mode in browser DevTools to confirm the application shell loads successfully from cache.

---

## Out of Scope

- Designing custom artwork for multi-density splash screen images beyond standard PWA icons.
- Push notifications via `SwPush`.
- Adding custom offline fallback pages beyond the core application shell.

---

## Further Notes

- Since Service Workers require HTTPS (except on `localhost`), production deployments must be served over secure layers. No additional action is needed as Firebase Hosting and Firebase App Hosting serve HTTPS by default.
