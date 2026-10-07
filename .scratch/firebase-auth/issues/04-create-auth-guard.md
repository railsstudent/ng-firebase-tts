# 04-create-auth-guard

Type: task
Status: ready-for-agent
Blocked by: 03-create-auth-service-and-session-listener

## Description

Create a functional Angular route guard (`authGuard: CanActivateFn`) to protect private application routes (`/dashboard`) from unauthenticated access.

## Target Files

- `src/app/core/guards/auth.guard.ts` (New)
- `src/app/core/guards/auth.guard.spec.ts` (New)
- `src/app/app.routes.ts`

## Specifications & Requirements

1. **Guard Implementation (`src/app/core/guards/auth.guard.ts`)**:
   - Functional `CanActivateFn`.
   - Injects `AuthenticationService` and `Router`.
   - Checks `authService.isAuthenticated()`:
     - If `true`, returns `true`.
     - If `false`, returns `router.createUrlTree(['/'])` to redirect to the Home page.
2. **Route Configuration (`src/app/app.routes.ts`)**:
   - Attach `canActivate: [authGuard]` to the `/dashboard` route.

## Acceptance Criteria

- [ ] Unauthenticated users attempting to navigate to `/dashboard` are redirected to `/`.
- [ ] Authenticated users are allowed access to `/dashboard`.
- [ ] Unit tests verify activation, redirection `UrlTree`, and dependency injection context.
