# 04-create-auth-guard

Type: task
Status: done
Blocked by: 03-create-auth-service-and-session-listener

## Description

Create a functional Angular route guard (`canActivateDashboard: CanActivateFn`) to protect private application routes (`/dashboard`) from unauthenticated access.

## Target Files

- `src/app/core/auth/auth.guard.ts` (New)
- `src/app/core/auth/auth.guard.spec.ts` (New)
- `src/app/app.routes.ts`

## Specifications & Requirements

1. **Guard Implementation (`src/app/core/auth/auth.guard.ts`)**:
   - Async functional `CanActivateFn`.
   - Injects `AuthService` and `Router`.
   - Calls `await authService.ensureAuth().catch((error) => console.error('Failed to restore auth session:', error))` to ensure session persistence is restored from `sessionStorage` and initial session state has settled, while logging and suppressing initialization errors so unauthenticated or offline visitors redirect cleanly.
   - Checks `authService.isAuthenticated()`:
     - If `true`, returns `true`.
     - If `false`, returns `router.createUrlTree([APP_LINKS.HOME])` to redirect to the Home page.
2. **Route Configuration (`src/app/app.routes.ts`)**:
   - Attach `canActivate: [canActivateDashboard]` to the `/dashboard` route.

## Acceptance Criteria

- [x] Route guard asynchronously awaits `authService.ensureAuth()` to settle session state before route evaluation.
- [x] Unauthenticated users attempting to navigate to `/dashboard` are redirected to `/home`.
- [x] Authenticated users are allowed access to `/dashboard`.
- [x] Unit tests verify activation, redirection `UrlTree`, `ensureAuth()` invocation, and dependency injection context.
