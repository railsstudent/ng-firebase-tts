# 10-implement-real-signin-signout-and-verify

Type: task
Status: ready-for-agent
Blocked by: 03-create-auth-service-and-session-listener, 04-create-auth-guard, 06-integrate-header-sign-out, 07-create-sign-in-modal-dialog, 09-wire-home-sign-in-modal-trigger

## Description

Wire real Firebase Web SDK operations (`signInWithEmailAndPassword`, `signOut`) into `AuthenticationService`, verify `browserSessionPersistence` against the local Auth Emulator, and execute the full integration verification suite.

## Target Files

- `src/app/core/services/authentication.service.ts`
- `src/app/core/services/authentication.service.spec.ts`
- `src/app/core/guards/auth.guard.spec.ts`

## Specifications & Requirements

1. **Wire Real Firebase SDK Operations in `AuthenticationService`**:
   - In `signIn(credentials: AuthCredentials)`:

     ```typescript
     const { auth, sdk } = await this.ensureAuth();
     await sdk.signInWithEmailAndPassword(auth, credentials.email, credentials.password);
     ```

   - In `signOut()`:

     ```typescript
     const { auth, sdk } = await this.ensureAuth();
     await sdk.signOut(auth);
     ```

   - Error mapping for common Firebase auth error codes (`auth/invalid-credential`, `auth/user-not-found`, `auth/wrong-password`, `auth/too-many-requests`).
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

- [ ] `signIn` and `signOut` interact with real Firebase Auth SDK / Emulator.
- [ ] `browserSessionPersistence` validated across tab reloads and new windows.
- [ ] 100% test pass rate with zero lint or build errors.
