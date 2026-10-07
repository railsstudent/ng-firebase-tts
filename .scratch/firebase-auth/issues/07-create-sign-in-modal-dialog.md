# 07-create-sign-in-modal-dialog

Type: task
Status: ready-for-agent
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener

## Description

Build the accessible Sign-In Modal component using Angular CDK Dialog (`@angular/cdk/dialog`) and Angular Signal Forms (`@angular/forms/signals`) with live validation and error handling.

## Target Files

- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.ts` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.html` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.css` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.spec.ts` (New)

## Specifications & Requirements

1. **Dialog Lifecycle & Accessibility**:
   - Use `DialogRef<void, SignInModalComponent>` from `@angular/cdk/dialog`.
   - Support Escape key and backdrop click to close.
   - ARIA modal dialog markup (`role="dialog"`, `aria-labelledby`, `aria-modal="true"`).
2. **Signal Forms Architecture**:
   - Use modern `@angular/forms/signals` (strictly zero legacy `FormGroup`).
   - Controls: `email` (required, valid email pattern) and `password` (required, minimum 6 characters).
   - Reactive validation hints displayed when fields are touched and invalid.
3. **Form Submission & State**:
   - State signals: `isSubmitting = signal(false);`, `errorMessage = signal<string | null>(null);`.
   - On valid submit:
     - Set `isSubmitting = true`, clear `errorMessage`.
     - Call `await this.authService.signIn({ email, password })`.
     - On success: close dialog (`this.dialogRef.close()`) and navigate to `/dashboard`.
     - On error: catch error, map to user-friendly message, set `errorMessage`.
4. **Tailwind CSS v4 Styling**:
   - `sign-in-modal.component.css` must include `@reference "../../../../../styles.css";` and use `@apply` utility classes.

## Acceptance Criteria

- [ ] Pure Signal Forms implementation with live field validation.
- [ ] Keyboard accessible, focus trapped, and closes on Escape/backdrop.
- [ ] Displays friendly error alert when sign-in fails.
- [ ] Unit tests cover validation rules, submission success, and error display.
