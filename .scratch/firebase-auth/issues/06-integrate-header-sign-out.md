# 06-integrate-header-sign-out

Type: task
Status: ready-for-agent
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener, 05-create-sign-out-icon

## Description

Integrate the interactive Sign-Out button into the global application header, rendering conditionally when authenticated and executing sign-out with home redirection on click.

## Target Files

- `src/app/shared/ui/layout/header/header.component.ts`
- `src/app/shared/ui/layout/header/header.component.html`
- `src/app/shared/ui/layout/header/header.component.spec.ts`

## Specifications & Requirements

1. **`HeaderComponent` TypeScript**:
   - Inject `AuthenticationService` and `Router`.
   - Expose `readonly isAuthenticated = this.authService.isAuthenticated;`.
   - Method `async onSignOut(): Promise<void>`:
     - Calls `await this.authService.signOut()`.
     - Calls `this.router.navigate(['/'])`.
2. **`HeaderComponent` Template**:
   - Wrap sign-out button inside `@if (isAuthenticated())`.
   - `<button class="app-button-icon" aria-label="Sign out" (click)="onSignOut()">` containing `<app-sign-out-icon />`.
3. **Unit Tests**:
   - Verify button is not rendered when `isAuthenticated()` is `false`.
   - Verify button is rendered when `isAuthenticated()` is `true`.
   - Verify clicking the button triggers `signOut()` and navigation to `/`.

## Acceptance Criteria

- [ ] Sign-out button is hidden for unauthenticated users and visible for authenticated users.
- [ ] Clicking sign-out calls `AuthenticationService.signOut()` and navigates home.
- [ ] Header spec tests pass with 100% assertion coverage.
