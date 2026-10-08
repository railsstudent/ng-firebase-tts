# 11-restore-auth-session-on-home-reload

Type: task
Status: done
Blocked by: 08-render-dynamic-home-auth-cta

## Description

Restore active Firebase authentication session state in `HomeComponent` on browser page reload (F5) without blocking initial render or violating ESLint floating promise rules.

## Target Files

- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.spec.ts`

## Specifications & Requirements

1. **`HomeComponent` TypeScript (`src/app/features/home/home.component.ts`)**:
   - In constructor, trigger `this.#authService.ensureAuth()` with an explicit `.catch()` error handler:

     ```typescript
     constructor() {
       this.#authService.ensureAuth().catch((error) => {
         console.error('Failed to restore auth session:', error);
       });
     }
     ```

   - Ensure the call is non-blocking (0ms initial render) and satisfies `@typescript-eslint/no-floating-promises`.
   - Preserve reactive binding to `this.#authService.isAuthenticated`.

2. **Unit Tests (`src/app/features/home/home.component.spec.ts`)**:
   - Mock `ensureAuth: vi.fn().mockResolvedValue({})` on `mockAuthService`.
   - Verify `ensureAuth()` is called during component instantiation.
   - Verify error during session restoration is safely caught without unhandled rejection.

## Acceptance Criteria

- [x] `HomeComponent` triggers `this.#authService.ensureAuth().catch(...)` on instantiation.
- [x] Session restoration on `/home` reload restores user state and dynamically displays "Launch Studio" for authenticated users.
- [x] No ESLint floating promise violations (`@typescript-eslint/no-floating-promises`).
- [x] All unit tests pass with 100% assertion coverage.
