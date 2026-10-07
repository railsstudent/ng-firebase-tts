# 03-create-auth-service-and-session-listener

Type: task
Status: ready-for-agent
Blocked by: 02-configure-firebase-auth-emulator

## Description

Implement the core singleton `AuthenticationService` managing dynamic `firebase/auth` loading, local emulator connection in development, tab-scoped session persistence (`browserSessionPersistence`), and the reactive `isAuthenticated` Signal.

## Target Files

- `src/app/shared/interfaces/auth-credentials.interface.ts` (New)
- `src/app/core/services/authentication.service.ts` (New)
- `src/app/core/services/authentication.service.spec.ts` (New)

## Specifications & Requirements

1. **Define `AuthCredentials` Interface**:
   - File: `src/app/shared/interfaces/auth-credentials.interface.ts`
   ```typescript
   export interface AuthCredentials {
     readonly email: string;
     readonly password: string;
   }
   ```
2. **`AuthenticationService` Implementation**:
   - Inject `ConfigService` and `WINDOW`.
   - State: `readonly #isAuthenticated = signal<boolean>(false);`
   - Public API: `readonly isAuthenticated = this.#isAuthenticated.asReadonly();`
   - Startup Logic:
     - Check `sessionStorage` in constructor. If Firebase user key exists, trigger `this.ensureAuth()` in the background to rehydrate the session.
     - If `sessionStorage` is empty, keep `isAuthenticated = false` without loading `firebase/auth` on cold start.
   - Module Loading & Initialization:
     - `#loadAuth()` dynamically imports `firebase/auth`.
     - In development mode on localhost (`isDevMode() && this.#isLocalhost()`), calls `connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })`.
     - Calls `setPersistence(auth, browserSessionPersistence)`.
     - Binds `onAuthStateChanged(auth, user => this.#isAuthenticated.set(!!user))`.
   - Helper `ensureAuth()`:
     - Checks and caches `#authReady: Promise<void> | null = null`.
     - Validates and returns `{ auth: this.#auth, sdk: this.#authSdk }` without non-null assertion `!` operators.
   - Interim Stubs: Provide stubbed `async signIn(...)` and `async signOut(...)` methods for downstream UI development.

## Acceptance Criteria

- [ ] Dynamic import guarantees zero `firebase/auth` code in the initial cold bundle.
- [ ] Connects to Auth Emulator on localhost in dev mode.
- [ ] `isAuthenticated` signal reacts to `onAuthStateChanged`.
- [ ] Unit tests verify initialization, emulator hook, and session detection.
