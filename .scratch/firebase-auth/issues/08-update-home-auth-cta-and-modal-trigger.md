# 08-update-home-auth-cta-and-modal-trigger

Type: task
Status: ready-for-agent
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener, 07-create-sign-in-modal-dialog

## Description

Update the Home landing page hero section to dynamically toggle the primary CTA between "Launch Studio" and "Sign In", loading the `SignInModalComponent` via `@defer (on interaction)`.

## Target Files

- `src/app/features/home/home.component.ts`
- `src/app/features/home/home.component.html`
- `src/app/features/home/home.component.spec.ts`

## Specifications & Requirements

1. **`HomeComponent` TypeScript**:
   - Inject `AuthenticationService`, `Dialog` from `@angular/cdk/dialog`, and `Router`.
   - Expose `readonly isAuthenticated = this.authService.isAuthenticated;`.
   - Method `openSignInModal()`: Opens `SignInModalComponent` via `this.dialog.open(SignInModalComponent, { width: '400px', ... })`.
2. **`HomeComponent` Template**:
   - Dynamic CTA block:
     ```html
     @if (isAuthenticated()) {
     <a routerLink="/dashboard" class="app-button-primary">Launch Studio</a>
     } @else {
     <button (click)="openSignInModal()" class="app-button-primary">Sign In</button>
     }
     ```
   - Wrap modal opening/import logic with `@defer (on interaction)` to maintain minimal cold start bundle.
3. **Unit Tests**:
   - Verify "Sign In" button is displayed when unauthenticated.
   - Verify "Launch Studio" link is displayed when authenticated.
   - Verify clicking "Sign In" triggers modal opening.

## Acceptance Criteria

- [ ] Hero CTA dynamically reflects authentication state.
- [ ] Clicking "Sign In" opens the deferred modal dialog.
- [ ] Home component specs pass with 100% assertion coverage.
