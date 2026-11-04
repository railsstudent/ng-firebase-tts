# 13: Reconcile Authentication Domain Glossary & Architecture Documentation

**What to build:** Remove implementation symbol identifiers from the Authentication & Session Management section of `GLOSSARY.md` so the glossary remains strictly domain-focused, and align `docs/adr/0012-firebase-auth-session-and-lazy-dialog-strategy.md` and `.scratch/firebase-auth/issues/03-create-auth-service-and-session-listener.md` with the implemented `AuthService` and `canActivateDashboard` contracts, including retryable single-flight `ensureAuth()` initialization and partial setup cleanup.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Remove parenthetical implementation identifiers (`AuthenticationService`, `isAuthenticated`, `browserSessionPersistence`) from the **Authentication & Session Management** section of `GLOSSARY.md`.
- [ ] Update `docs/adr/0012-firebase-auth-session-and-lazy-dialog-strategy.md` to reference `AuthService` and `canActivateDashboard`, and document retryable single-flight `ensureAuth()` initialization with partial listener cleanup and idempotent emulator setup.
- [ ] Update `.scratch/firebase-auth/issues/03-create-auth-service-and-session-listener.md` and `.scratch/firebase-auth/issues/04-create-auth-guard.md` specifications to reflect `src/app/core/auth/` paths, `!auth.emulatorConfig` emulator guarding, `try / catch` listener cleanup around `auth.authStateReady()`, `.catch()` reset on `#authReady`, and `canActivateDashboard` error handling.
- [ ] `npm run cspell` (via `npm run lint`) passes with zero spelling or lint errors.
