# 0012: Firebase Auth Session Persistence and Deferred Dialog Strategy

- **Status**: Accepted
- **Date**: 2026-10-07

## Context

The application allows users to explore multimodal image analysis, obscure fact generation, and real-time streaming speech synthesis. To protect serverless Vertex AI and Gemini compute resources and provide user identity boundaries, client-side authentication is required.

However, adding authentication to a client-side Angular application introduces architectural trade-offs:

1. **Initial Bundle Bloat**: Eagerly bundling `@angular/cdk/dialog` and the Firebase Auth SDK (`firebase/auth`) significantly increases the initial JavaScript payload size. For cold visitors landing on the Home Screen, loading hundreds of kilobytes of authentication and dialog code upfront degrades First Contentful Paint (FCP) and Time to Interactive (TTI).
2. **Session Lifecycle & Privacy Constraints**: The application needs to balance user convenience against privacy on shared computers. Storing auth tokens in permanent disk storage (`localStorage`/IndexedDB via `browserLocalPersistence`) keeps sessions alive indefinitely across browser restarts. Conversely, keeping tokens strictly in memory (`inMemoryPersistence`) wipes the user's session on every routine page reload (F5).
3. **Form Reactivity & Performance**: Legacy reactive forms (`FormGroup`, `FormControl` from `@angular/forms`) introduce unnecessary boilerplate, runtime overhead, and non-signal-based state management that conflicts with Angular 22's zoneless, signal-first architecture.
4. **Direct Route Protection**: Unauthenticated users could attempt to navigate directly to the workspace route (`/dashboard`) via URL bookmarks or direct links, bypassing landing page restrictions.

---

## Decision

We establish the following architectural strategies for authentication, session management, and dialog interaction:

### 1. Tab-Scoped Session Persistence (`browserSessionPersistence`)

- Firebase Auth is configured to use **`browserSessionPersistence`**.
- Auth tokens and refresh keys are stored exclusively in `sessionStorage` for the active browser tab.
- **Tab Lifetime Guarantee**: Closing the browser tab or terminating the browser process automatically wipes the session tokens, terminating the user session and protecting privacy.
- **Reload Resilience**: Reloading the active browser tab (F5) or navigating between routes within the tab retains the session without prompting the user to sign in again.

### 2. Zero-Bundle Cold Startup Inspection & Lazy `firebase/auth` Loading

- `AuthenticationService` is implemented as a core singleton service that avoids importing `firebase/auth` on startup.
- **Cold Inspection**: On application startup, `AuthenticationService` synchronously checks `window.sessionStorage` for the presence of Firebase Auth session keys (`firebase:authUser:*`).
  - **No Key Found (Cold Visit / New Tab)**: `isAuthenticated()` initializes to `false`. Zero bytes of `firebase/auth` are loaded or executed.
  - **Key Found (Active Tab Refresh)**: `AuthenticationService` lazily imports `firebase/auth` in the background to restore the user session and synchronize `isAuthenticated = signal(true)`.
- **On-Demand Sign-In**: When an unauthenticated user opens the sign-in modal and submits credentials, `AuthenticationService.signIn(...)` dynamically imports `firebase/auth`, applies `browserSessionPersistence`, and authenticates against Firebase.

### 3. Accessible Dialog via `@angular/cdk/dialog` with `@defer (on interaction)`

- The sign-in dialog is implemented using `@angular/cdk/dialog` to ensure out-of-the-box compliance with WAI-ARIA modal dialog specifications (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trapping, backdrop styling, and native Escape key dismissal).
- The dialog component and CDK dependencies are wrapped inside Angular's **`@defer (on interaction)`** template block, ensuring they are only downloaded when the user interacts with the "Sign In" button.

### 4. Modern Signal Forms (`@angular/forms/signals`)

- The sign-in form is built exclusively with Angular Signal Forms (`@angular/forms/signals`).
- Form inputs, validation state (required email, password length), submission status, and error states are modeled as reactive Signals, maintaining consistency with the codebase's zoneless reactivity guidelines.

### 5. Protected Route Guard (`authGuard`)

- Direct access to the `/dashboard` route is guarded by an Angular functional `canActivate` guard (`authGuard`).
- If `AuthenticationService.isAuthenticated()` is `false`, navigation to `/dashboard` is canceled and redirected to `/home`.

### 6. Atomic Reactive State & Minimal Public API Surface

- The authentication layer manages session state internally as a single atomic reactive Signal and exposes a derived, readonly `isAuthenticated: Signal<boolean>` to consuming components and route guards.
- The service defines a minimal, bounded public API contract:
  - `readonly isAuthenticated: Signal<boolean>`
  - `signIn(credentials: AuthCredentials): Promise<void>`
  - `signOut(): Promise<void>`
- All third-party SDK lifecycles, token storage keys, and background initialization promises remain strictly encapsulated behind this public service boundary.

---

## Consequences

### Positive

- **Near-Zero Startup Overhead**: Cold visits to the landing page remain ultralight; neither `firebase/auth` nor `@angular/cdk/dialog` are included in the initial bundle.
- **Privacy by Default**: Closing the tab guarantees complete session termination without leaving persistent tokens on shared devices.
- **Seamless User Experience**: Page reloads during active studio sessions are preserved without interruption.
- **Full Accessibility**: Built-in CDK focus trapping and screen reader attributes eliminate custom modal accessibility bugs.

### Negative / Trade-offs

- **First Interaction Latency**: When a user clicks "Sign In" for the first time, a small network roundtrip is incurred to download the deferred dialog and auth chunks. This is mitigated by lean chunk sizes and fast modern networks.
- **Tab Isolation**: Opening the application in a new browser tab requires signing in separately, as session storage is scoped per-tab. This is an intentional security design choice.
