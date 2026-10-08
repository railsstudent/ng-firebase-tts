# 03-create-auth-service-and-session-listener

Type: task
Status: done
Blocked by: 02-configure-firebase-auth-emulator

## Description

Implement the core singleton `AuthenticationService` managing dynamic `firebase/auth` loading, local emulator connection in development, tab-scoped session persistence (`browserSessionPersistence`), and the reactive `isAuthenticated` Signal.

## Target Files

- `src/app/shared/interfaces/auth-credentials.interface.ts` (New)
- `src/app/core/utils/host.util.ts` (New)
- `src/app/core/utils/host.util.spec.ts` (New)
- `src/app/core/services/config.service.ts` (Refactor: add `getApp()`, use `host.util`)
- `src/app/core/services/config.service.spec.ts` (Update with `getApp()` test)
- `src/app/core/services/auth.service.ts` (New)
- `src/app/core/services/auth.service.spec.ts` (New)

## Specifications & Requirements

1. **Extract `isLocalhost` Utility & Update `ConfigService`**:
   - File: `src/app/core/utils/host.util.ts` & `src/app/core/utils/host.util.spec.ts`
     - Extract `LOCAL_DOMAINS` and `isLocalhost(win?: Window | null): boolean` as a pure, SSR-safe utility function.
   - File: `src/app/core/services/config.service.ts`:
     - Refactor to use `isLocalhost(this.#window)` from `@/core/utils/host.util`.
     - Expose `async getApp(): Promise<FirebaseApp>` with self-initializing idempotency (calls `this.initialize()` and awaits `this.#appReady` before returning `this.#app`) to prevent startup race conditions.

2. **Define `AuthCredentials` Interface**:
   - File: `src/app/shared/interfaces/auth-credentials.interface.ts`

   ```typescript
   export interface AuthCredentials {
     readonly email: string;
     readonly password: string;
   }
   ```

3. **`AuthService` Implementation (`src/app/core/services/auth.service.ts`)**:
   - **Service Decorator**: `@Service()` from `@angular/core`.
   - **Injections & Backing State** (using native `#` private fields):
     - `readonly #configService = inject(ConfigService);`
     - `readonly #window = inject(WINDOW);`
     - `readonly #destroyRef$ = inject(DestroyRef);`
     - `readonly #user = signal<User | null>(null);`
     - `#auth: Auth | null = null;`
     - `#authSdk: typeof import('firebase/auth') | null = null;`
     - `#authReady: Promise<void> | null = null;`
   - **Public API Surface** (purely reactive signals & actions):
     - `readonly user = this.#user.asReadonly();`
     - `readonly isAuthenticated = computed(() => !!this.#user());`
     - `async signIn(credentials: AuthCredentials): Promise<void>`
     - `async signOut(): Promise<void>`
   - **Constructor**:
     - Pure dependency injection with zero async side-effects and zero manual storage snooping (preserving instant FCP and 0 KB cold-start bundle for unauthenticated visitors).
   - **Private Helper Methods** (TypeScript `private` keyword, without `#` prefix per `AGENTS.md`):
     - `private async loadAuth(): Promise<void>`:
       - Awaits `Promise.all([this.#configService.getApp(), import('firebase/auth')])`.
       - Obtains `auth` via `authSdk.getAuth(app)`.
       - On localhost (`isLocalhost(this.#window)`), connects to emulator: `authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })`.
       - Sets tab-scoped persistence: `await authSdk.setPersistence(auth, authSdk.browserSessionPersistence)`.
       - Binds `const unsubscribe = authSdk.onAuthStateChanged(auth, user => this.#user.set(user))`.
       - Registers cleanup: `this.#destroyRef$.onDestroy(unsubscribe)`.
       - Awaits `await auth.authStateReady()` to settle initial session state.
       - Caches `#auth = auth` and `#authSdk = authSdk`.
     - `async ensureAuth(): Promise<{ auth: Auth; sdk: typeof import('firebase/auth') }>`:
       - Idempotently caches `#authReady ??= this.loadAuth()`.
       - Awaits `#authReady`.
       - Validates and returns `{ auth: this.#auth, sdk: this.#authSdk }` without non-null assertions.
   - **Public Actions**:
     - `async signIn(credentials: AuthCredentials): Promise<void>`:
       - Awaits `this.ensureAuth()`.
       - Calls `sdk.signInWithEmailAndPassword(auth, credentials.email, credentials.password)`.
     - `async signOut(): Promise<void>`:
       - Awaits `this.ensureAuth()`.
       - Calls `sdk.signOut(auth)`.

## Acceptance Criteria

- [x] `isLocalhost` extracted to `@/core/utils/host.util` with unit tests covering IPv4, IPv6, localhost, production domains, and SSR null windows.
- [x] `ConfigService.getApp()` exposed with self-initializing promise resolution.
- [x] `ConfigService` refactored to use `isLocalhost(this.#window)`.
- [x] `AuthService` decorated with `@Service()` from `@angular/core`.
- [x] Dynamic import guarantees zero `firebase/auth` code in the initial cold bundle.
- [x] Connects to Auth Emulator on localhost using `isLocalhost(this.#window)`.
- [x] `user` signal tracks authenticated user; `isAuthenticated` is computed from `user()`.
- [x] `user` and `isAuthenticated` signals react to `onAuthStateChanged`.
- [x] `onAuthStateChanged` unsubscribe callback registered with `DestroyRef.onDestroy`.
- [x] Initial session state settled using `auth.authStateReady()`.
- [x] Unit tests verify initialization, emulator hook, `user` signal, cleanup, and sign in / sign out.
