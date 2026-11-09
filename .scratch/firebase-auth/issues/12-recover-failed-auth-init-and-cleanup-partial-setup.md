# 12: Recoverable Single-Flight Auth Initialization & Partial Setup Rollback

**What to build:** Ensure that when lazy initialization of the Authentication Service (`loadAuth()`) rejects—such as during a temporary network or chunk load outage—concurrent callers share the single failed attempt and receive the original error, any partially registered `onAuthStateChanged` listener is immediately unsubscribed, and the cached initialization promise (`#authReady`) is cleared so a subsequent call can retry cleanly without reloading the page or re-running `connectAuthEmulator`. Ordinary post-initialization `signIn` failures must leave the resolved initialization cache intact.

**Blocked by:** None (can start immediately)

**Status:** done

---

## Target Files

- `src/app/core/auth/auth.service.ts`
- `src/app/core/auth/auth.guard.ts`
- `src/testing/firebase.mock.ts`
- `src/app/core/auth/auth.service.spec.ts`
- `src/app/core/auth/auth.guard.spec.ts`

---

## Exact Implementation Guide

### 1. Update `AuthService` (`src/app/core/auth/auth.service.ts`)

In `loadAuth()` and `ensureAuth()`, apply three changes:

1. **Idempotent Emulator Setup**: Guard `authSdk.connectAuthEmulator(...)` with `!auth.emulatorConfig` so retrying `loadAuth()` after a downstream failure does not re-configure the emulator on the same singleton `Auth` instance.
2. **Partial Listener Cleanup**: Wrap `await auth.authStateReady()` in a `try / catch` block after registering `const unsubscribe = authSdk.onAuthStateChanged(...)`. If `auth.authStateReady()` rejects, invoke `unsubscribe()` and re-throw `error`. Register `this.#destroyRef$.onDestroy(unsubscribe)` only after `auth.authStateReady()` resolves.
3. **Single-Flight Reset on Initialization Failure**: Attach `.catch(...)` to `this.loadAuth()` when assigning `this.#authReady` in `ensureAuth()` so concurrent callers share the in-flight attempt, receive the original error, and reset `this.#authReady = null` only when `loadAuth()` rejects.

Replace `loadAuth()` and `ensureAuth()` in `src/app/core/auth/auth.service.ts` (lines 23–58) with:

```typescript
  private async loadAuth(): Promise<void> {
    const [firebaseApp, authSdk] = await Promise.all([this.#configService.getApp(), import('firebase/auth')]);

    const auth = authSdk.getAuth(firebaseApp);
    if (isLocalhost(this.#window) && !auth.emulatorConfig) {
      authSdk.connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    }

    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    const unsubscribe = authSdk.onAuthStateChanged(auth, (user) => this.#user.set(user));

    try {
      await auth.authStateReady();
    } catch (error) {
      unsubscribe();
      throw error;
    }

    this.#destroyRef$.onDestroy(unsubscribe);

    this.#auth = auth;
    this.#authSdk = authSdk;
  }

  async ensureAuth(): Promise<{ auth: Auth; sdk: typeof import('firebase/auth') }> {
    if (!this.#authReady) {
      this.#authReady = this.loadAuth().catch((error) => {
        this.#authReady = null;
        throw error;
      });
    }

    await this.#authReady;

    if (!this.#auth) {
      throw new Error('Auth is not initialized');
    }

    if (!this.#authSdk) {
      throw new Error('Auth SDK does not exist');
    }

    return { auth: this.#auth, sdk: this.#authSdk };
  }
```

---

### 2. Update Auth Mocks (`src/testing/firebase.mock.ts`)

Update `MockAuthMocks` and `createAuthMocks()` in `src/testing/firebase.mock.ts` (lines 81–115) so `mockAuthInstance` tracks `emulatorConfig` when `connectAuthEmulator` is called:

```typescript
interface MockAuthMocks {
  mockAuthInstance: {
    name: string;
    app: object;
    currentUser: null;
    emulatorConfig: unknown;
    authStateReady: ReturnType<typeof vi.fn>;
  };
  mockFirebaseAuth: {
    getAuth: ReturnType<typeof vi.fn>;
    connectAuthEmulator: ReturnType<typeof vi.fn>;
    browserSessionPersistence: string;
    setPersistence: ReturnType<typeof vi.fn>;
    onAuthStateChanged: ReturnType<typeof vi.fn>;
    authStateReady: ReturnType<typeof vi.fn>;
    signInWithEmailAndPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
}

function createAuthMocks(): MockAuthMocks {
  const mockAuthInstance = {
    name: '[DEFAULT]',
    app: {},
    currentUser: null,
    emulatorConfig: null as unknown,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  };

  let defaultAuthStateCallback: ((user: unknown) => void) | null = null;

  const mockFirebaseAuth = {
    getAuth: vi.fn(() => mockAuthInstance),
    connectAuthEmulator: vi.fn((_auth: unknown, url: string) => {
      mockAuthInstance.emulatorConfig = { url };
    }),
    browserSessionPersistence: 'SESSION',
```

---

### 3. Add Failure-Path & Retry Unit Tests (`src/app/core/auth/auth.service.spec.ts`)

1. In `setupAuthEventLoop()` (`src/app/core/auth/auth.service.spec.ts`, lines 55–59), reset `emulatorConfig` and `authStateReady` before each test:

```typescript
  function setupAuthEventLoop(): void {
    authStateCallback = null;
    mockAuthInstance = vi.mocked(getAuth)() as unknown as Auth;
    (mockAuthInstance as { emulatorConfig: unknown }).emulatorConfig = null;
    vi.mocked(mockAuthInstance.authStateReady).mockReset().mockResolvedValue(undefined);
    vi.mocked(getAuth).mockClear();
```

1. Append the following two unit tests inside the `describe('AuthService', ...)` block in `src/app/core/auth/auth.service.spec.ts`:

```typescript
it('should share a failed initialization attempt across concurrent callers, clean up partial listener, and succeed on retry with one active listener', async () => {
  const service = configureTestBed();
  const initError = new Error('Network error during authStateReady');
  const failedAttemptUnsubscribe = vi.fn();
  const retryAttemptUnsubscribe = vi.fn();

  vi.mocked(onAuthStateChanged)
    .mockImplementationOnce((_auth, nextOrObserver) => {
      authStateCallback = typeof nextOrObserver === 'function' ? nextOrObserver : nextOrObserver.next;
      return failedAttemptUnsubscribe;
    })
    .mockImplementationOnce((_auth, nextOrObserver) => {
      authStateCallback = typeof nextOrObserver === 'function' ? nextOrObserver : nextOrObserver.next;
      return retryAttemptUnsubscribe;
    });

  vi.mocked(mockAuthInstance.authStateReady).mockRejectedValueOnce(initError).mockResolvedValueOnce(undefined);

  const [firstResult, secondResult] = await Promise.allSettled([
    service.signIn({ email: 'user@example.com', password: 'ValidPassword123' }),
    service.signIn({ email: 'user@example.com', password: 'ValidPassword123' }),
  ]);

  expect(firstResult).toEqual({ status: 'rejected', reason: initError });
  expect(secondResult).toEqual({ status: 'rejected', reason: initError });
  expect(getAuth).toHaveBeenCalledTimes(1);
  expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
  expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  expect(failedAttemptUnsubscribe).toHaveBeenCalledTimes(1);
  expect(signInWithEmailAndPassword).not.toHaveBeenCalled();

  await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });

  expect(getAuth).toHaveBeenCalledTimes(2);
  expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
  expect(onAuthStateChanged).toHaveBeenCalledTimes(2);
  expect(retryAttemptUnsubscribe).not.toHaveBeenCalled();
  expect(service.isAuthenticated()).toBe(true);

  TestBed.resetTestingModule();

  expect(failedAttemptUnsubscribe).toHaveBeenCalledTimes(1);
  expect(retryAttemptUnsubscribe).toHaveBeenCalledTimes(1);
});

it('should keep initialization cached when an ordinary signInWithEmailAndPassword error occurs', async () => {
  const service = configureTestBed();
  const credentialError = new Error('auth/invalid-credential');

  vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(credentialError);

  await expect(service.signIn({ email: 'user@example.com', password: 'WrongPassword123' })).rejects.toThrow(
    credentialError,
  );

  expect(getAuth).toHaveBeenCalledTimes(1);
  expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  expect(mockUnsubscribe).not.toHaveBeenCalled();
  expect(service.isAuthenticated()).toBe(false);

  await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });

  expect(getAuth).toHaveBeenCalledTimes(1);
  expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
  expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
  expect(service.isAuthenticated()).toBe(true);
});
```

---

### 4. Swallow Background Session-Check Rejections in `canActivateDashboard` (`src/app/core/auth/auth.guard.ts` & `src/app/core/auth/auth.guard.spec.ts`)

Just like `HomeComponent` swallows `ensureAuth()` errors in its constructor via `.catch((error) => console.error('Failed to restore auth session:', error))` so cold visitors do not see an error banner while `AuthService` resets `#authReady` and cleans up its listener, `canActivateDashboard` should catch `ensureAuth()` rejections so the guard cleanly redirects unauthenticated/offline visitors to `/home` rather than aborting navigation with an unhandled router rejection.

1. In `src/app/core/auth/auth.guard.ts` (line 11), update `await authService.ensureAuth();` to:

```typescript
await authService.ensureAuth().catch((error) => console.error('Failed to restore auth session:', error));
```

2. Append the following unit test to `describe('canActivateDashboard', ...)` in `src/app/core/auth/auth.guard.spec.ts`:

```typescript
it('should catch ensureAuth errors, log to console.error, and redirect to home UrlTree', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const rejectionError = new Error('Auth initialization failed');
  mockAuthService.ensureAuth.mockRejectedValueOnce(rejectionError);
  isAuthenticatedSignal.set(false);

  const result = await TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

  expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to restore auth session:', rejectionError);
  expect(mockRouter.createUrlTree).toHaveBeenCalledWith([APP_LINKS.HOME]);
  expect(result).toBe(mockUrlTree);
  consoleErrorSpy.mockRestore();
});
```

---

## Verification Commands

```bash
npx ng test --watch=false --include src/app/core/auth/auth.service.spec.ts --include src/app/core/auth/auth.guard.spec.ts
npm run lint
```

---

## Acceptance Criteria

- [x] `ensureAuth()` resets `#authReady = null` inside `.catch(...)` attached to `this.loadAuth()` so concurrent callers share a single failed attempt and subsequent calls can retry initialization.
- [x] `loadAuth()` unsubscribes the `onAuthStateChanged` listener if `auth.authStateReady()` rejects and only registers `this.#destroyRef$.onDestroy(unsubscribe)` after `auth.authStateReady()` succeeds.
- [x] `loadAuth()` guards `connectAuthEmulator` with `!auth.emulatorConfig` so retries do not re-configure the emulator on an already-connected `Auth` singleton.
- [x] Ordinary `signInWithEmailAndPassword` rejections after `ensureAuth()` resolves do not reset `#authReady` or re-run `loadAuth()`.
- [x] `canActivateDashboard` catches `ensureAuth()` rejections and redirects cleanly to `APP_LINKS.HOME` without throwing an unhandled router error.
- [x] Unit tests in `src/app/core/auth/auth.service.spec.ts` and `src/app/core/auth/auth.guard.spec.ts` pass.
- [x] `npm run lint` passes with zero errors.
