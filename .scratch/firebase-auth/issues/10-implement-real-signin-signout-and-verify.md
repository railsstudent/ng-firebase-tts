# 10-implement-real-signin-signout-and-verify

Type: task
Status: done
Blocked by: 03-create-auth-service-and-session-listener, 04-create-auth-guard, 06-integrate-header-sign-out, 07-create-sign-in-modal-dialog, 09-wire-home-sign-in-modal-trigger

## Description

Wire real Firebase Web SDK operations (`signInWithEmailAndPassword`, `signOut`) into `AuthService`, verify `browserSessionPersistence` against the local Auth Emulator, and execute the full integration verification suite.

## Target Files

- `src/app/core/services/auth.service.ts`
- `src/app/core/services/auth.service.spec.ts`
- `src/app/core/guards/auth.guard.spec.ts`

## Specifications & Requirements

1. **Wire Real Firebase SDK Operations in `AuthService`**:
   - In `signIn({ email, password }: AuthCredentials)`:

     ```typescript
     if (!email || !password) {
      this.#user.set(null);
      return;
     }

     const { auth, sdk } = await this.ensureAuth();
     await sdk.signInWithEmailAndPassword(auth, email, password);
     ```

   - In `signOut()`:

     ```typescript
     const { auth, sdk } = await this.ensureAuth();
     await sdk.signOut(auth);
     ```

   - Generic non-technical error alert handled directly by `SignInModalComponent` per `spec.md`.
2. **Local Emulator & Session Verification**:
   - Start local emulator: `npm run emulators:auth`.
   - Verify user sign-in persists in `sessionStorage` (`browserSessionPersistence`).
   - Verify tab refresh maintains authentication state.
   - Verify opening a new browser tab or window starts unauthenticated.
   - Verify clicking sign-out terminates session and clears state.
3. **Full Suite Verification**:
   - Run targeted test suite via `angular-cli` with coverage.
   - Run repo-wide validation (`npm run lint`, `npm run format:check`, `npm run build`).

## Acceptance Criteria

- [x] `signIn` and `signOut` interact with real Firebase Auth SDK / Emulator.
- [x] `browserSessionPersistence` validated across tab reloads and new windows.
- [x] 100% test pass rate with zero lint or build errors.
