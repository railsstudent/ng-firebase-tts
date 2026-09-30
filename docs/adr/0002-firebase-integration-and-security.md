# 0002: Firebase Integration, App Check, and SSR Security Strategy

- **Status**: Accepted
- **Date**: 2026-08-28

## Context

Our application relies on Firebase services as its backend architecture. Because client-side web applications expose API keys in their network requests, we must secure our endpoints against unauthorized quota theft, crawling, and API abuse (particularly on billing-sensitive Gen AI endpoints). Additionally, because we support Server-Side Rendering (SSR) and automated build prerendering (such as Firebase App Hosting cloud compilations), the app boot process must not crash when running in Node.js environments where browser elements are absent.

## Decision

We will establish a secure, SSR-safe Firebase core architecture using runtime configurations, dynamic Remote Config defaults, and App Check protection:

1. **Dynamic Config & SDK Loading**:
   - Load project credentials asynchronously at runtime from `public/firebase.config.json` instead of hardcoding them into compiling environments.
   - Dynamically import core Firebase Web SDKs (`firebase/app`, `firebase/remote-config`) on-demand when entering feature routes via `provideEnvironmentInitializer`, keeping initial landing views free of Firebase dependencies.
2. **App Check Protection**:
   - Initialize App Check using the **reCAPTCHA Enterprise** provider for web clients.
   - Defer App Check initialization just-in-time (JIT) until `getAiBackend()` is invoked to keep the initial rendering path and route navigation non-blocking.
   - Support zero-friction developer testing by loading pre-registered App Check debug tokens from `.env` (packaged into `firebase.config.json`) and assigning the explicit string directly to `self.FIREBASE_APPCHECK_DEBUG_TOKEN`. This avoids the manual console-registration overhead that setting the value to `true` (auto-generating fresh tokens) would require on every developer session.
   - Defer App Check initialization entirely in non-browser execution contexts (e.g., SSR or build-time compilation) to prevent server-side failures.
3. **Resilient Remote Config & Bootstrap Coordination**:
   - Coordinate background initialization through internal synchronization (`#appReady`), ensuring idempotent SDK loading and thread-safe execution across concurrent calls.
   - Register a local fallback configuration `public/remote-config-defaults.json` checked into Git.
   - If `fetchAndActivate()` fails during build prerendering or due to user offline states/timeouts, the app catches the error and utilizes the local fallback file gracefully without resetting initialized core app instances.
4. **Declarative Remote Config & Tooling Ecosystem**:
   - Maintain the project's multi-app Remote Config parameters and conditions declaratively in `firebase/remote-config-template.json` checked into Git.
   - **Build & Synchronization Tooling**:
     - **`firebase/scripts/prebuild.mjs` (`npm run prebuild`)**: The prebuild orchestrator that concurrently executes configuration generators in parallel using native ES Modules (`Promise.all`), optimizing local build and Firebase App Hosting deployment times.
     - **`firebase/scripts/generate-firebase-config.mjs` (`npm run config:generate`)**: Ingests environment variables from `.env` and generates the runtime config artifact at `public/firebase.config.json`.
     - **`firebase/scripts/get-firebase-remote-config.mjs` (`npm run config:fetch`)**: Fetches active Remote Config fallback defaults and writes them to `public/remote-config-defaults.json`.
     - **`firebase/scripts/deploy-remote-config.mjs` (`npm run config:pull` / `npm run config:push`)**: Manages the Remote Config template lifecycle:
       - **`pull`**: Fetches the active cloud configuration into `firebase/remote-config-template.json`.
       - **`push`**: Synchronizes live `version`/`etag` metadata into `firebase/remote-config-template.json` to prevent optimistic locking (409) conflicts and deploys directly via `firebase deploy --only remoteconfig`.

## Consequences

### Positive

- High security posture protecting Google Cloud API budgets from bot networks.
- Reduced initial landing page footprint by deferring Firebase SDK parsing and initialization to feature routes.
- Protected Core Web Vitals (FCP/LCP) through non-blocking, asynchronous SDK bootstrapping.
- Safe, compile-friendly, non-crashing build adapter compilation during automated Firebase App Hosting builds.
- Seamless developer testing via automated App Check debug tokens.
- Multi-app Remote Config values and conditional rules are version-controlled in Git, minimizing manual Firebase Web Console updates.

### Negative / Trade-offs

- First-time entry to feature routes involves an asynchronous dynamic chunk fetch before backend SDK services are active.
