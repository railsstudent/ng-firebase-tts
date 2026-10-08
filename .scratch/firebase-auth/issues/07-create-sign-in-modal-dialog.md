# 07-create-sign-in-modal-dialog

Type: task
Status: done
Blocked by: 01-update-design-contract-for-auth, 03-create-auth-service-and-session-listener

## Description

Build the accessible Sign-In Modal component (`SignInModalComponent`) and its accompanying standalone close icon (`CloseIconComponent`) using Angular CDK Dialog (`@angular/cdk/dialog`) and Angular Signal Forms (`@angular/forms/signals`) with live validation and error handling, implementing the design contracts specified in Section 13 of `DESIGN.md` and the desktop and mobile Stitch screens.

## Target Files

- `src/app/shared/ui/icons/close-icon.component.ts` (New)
- `src/app/shared/ui/icons/close-icon.component.spec.ts` (New)
- `src/app/shared/ui/sign-in-modal/schemas/sign-in.schema.ts` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.ts` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.html` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.css` (New)
- `src/app/shared/ui/sign-in-modal/sign-in-modal.component.spec.ts` (New)

## Design & Visual Specifications

1. **Design System Contract (`DESIGN.md` Section 13: Sign-In Modal Dialog)**:
   - **Overlay & Backdrop**: Centered modal container over semi-transparent blurred backdrop (`backdrop-blur-sm bg-black/40`).
   - **Modal Card Surface (`.modal-card`)**:
     - Geometry: `rounded-2xl bg-(--color-surface-card) border border-(--color-surface-border) p-6 sm:p-8 max-w-md w-full shadow-2xl backdrop-blur-md flex flex-col gap-5`.
   - **Header (`.modal-header`)**:
     - Layout: `flex items-center justify-between pb-2 border-b border-(--color-surface-border)/60`.
     - Title (`#sign-in-dialog-title`): `"Sign In"` (`text-xl sm:text-2xl font-bold text-(--color-text-primary)`).
     - Close Button (`.modal-close-btn`): Top-right button (`p-1.5 rounded-lg text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all`) with `aria-label="Close dialog"`, housing `<app-close-icon />`.
   - **Form Fields & Validation**:
     - **Email Field**:
       - Label: `"Email Address"` (`text-xs uppercase font-semibold tracking-wider text-(--color-text-muted) mb-1.5 block`).
       - Input: `<input type="email" autocomplete="username">` (`w-full bg-slate-900 border border-slate-700 text-(--color-text-primary) rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all`).
       - Validation Hint: Rendered below touched invalid field in `text-xs text-(--color-error-text) mt-1`.
     - **Password Field**:
       - Label: `"Password"` (`text-xs uppercase font-semibold tracking-wider text-(--color-text-muted) mb-1.5 block`).
       - Input: `<input type="password" autocomplete="current-password">` (`w-full bg-slate-900 border border-slate-700 text-(--color-text-primary) rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all`).
       - Validation Hint: Rendered below touched invalid field in `text-xs text-(--color-error-text) mt-1`.
     - **Error Alert Banner (`.error-block`)**:
       - Rendered conditionally on failed sign-in attempts: `@apply error-block mt-2 mb-2 text-sm` (`bg-(--color-error-bg) border border-(--color-error-border) text-(--color-error-text) px-4 py-3 rounded-lg relative`).
   - **Actions (`.modal-actions`)**:
     - Submit Button (`.btn-submit`): Primary button **"Sign In"** (`@apply btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2`).
     - Loading State: Animated SVG spinner using `<app-spinner-icon svgClass="animate-spin h-5 w-5" />` (`@/shared/ui/icons/spinner-icon.component`) rendered when `signInForm().submitting()` is `true`, disabling further submissions.
   - **Strict Constraints**:
     - Strictly NO third-party SSO buttons, badges, or provider links (e.g. Google, GitHub, Apple).
     - Strictly NO "Forgot Password?" or password reset recovery links/flows.
     - Strictly NO "Sign Up" / "Create Account" registration links, toggles, or secondary modes.
     - Strictly NO biometric, WebAuthn, or Passkey options.
     - Strictly NO secondary marketing footers, terms/privacy links, or external badges inside the dialog. Only the designated Header (Title + Close 'X' button), conditional Error block, Email field, Password field, and Primary "Sign In" button are permitted.

2. **Desktop Viewport Screen Contract (`Obsidian & Indigo AI Studio Home Screen with Sign-In Modal` - Screen ID: `57acb0b8ea9b41869ca631da97962637`)**:
   - Centered `max-w-md` floating dialog over dimmed background overlay.
   - Form inputs with crisp slate borders and focused electric indigo glow rings.

3. **Mobile Viewport Screen Contract (`Firebase AI Logic Studio Mobile Sign-In Modal` - Screen ID: `3cdd32fdeb4e4c0b8d2cd236f382c8e2`)**:
   - Full-width responsive dialog padded for mobile screens (`p-6 w-full max-w-sm sm:max-w-md mx-4`).
   - Touch targets and font sizing optimized for mobile viewports.

## Technical & Implementation Requirements

1. **Close Icon Component (`CloseIconComponent`)**:
   - Standalone component in `src/app/shared/ui/icons/close-icon.component.ts`.
   - Selector: `app-close-icon`.
   - Stylesheet: `styleUrl: './icon.css'` (`@apply app-icon`).
   - SVG Blueprint: `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full" aria-hidden="true"`.
   - SVG Paths: `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`.
2. **Dialog Lifecycle & Accessibility**:
   - Use `DialogRef<void, SignInModalComponent>` from `@angular/cdk/dialog`.
   - Support `Escape` key and backdrop click dismissal.
   - ARIA modal markup: `role="dialog"`, `aria-labelledby="sign-in-dialog-title"`, `aria-modal="true"`.
   - Trap keyboard focus within the dialog; autofocus the email input on open.
3. **Signal Forms Architecture (`@angular/forms/signals`)**:
   - Controls: `email` (required, valid email pattern) and `password` (required, minimum 6 characters).
   - Reactive validation hints displayed when fields are touched and invalid.
   - Strictly NO legacy `FormGroup` / `FormControl` / `FormBuilder`.
4. **Form Submission & State**:
   - Injections: `DialogRef<void, SignInModalComponent>` (`@angular/cdk/dialog`), `AuthService` (`@/core/services/auth.service`), `Router` (`@angular/router`).
   - Imports: `CloseIconComponent` from `@/shared/ui/icons/close-icon.component`, `SpinnerIconComponent` from `@/shared/ui/icons/spinner-icon.component`, `AuthCredentials` from `@/core/interfaces/auth-credentials.interface`, `APP_LINKS` from `@/core/constants/routes.const`.
   - State signals: `errorMessage = signal<string | undefined>(undefined);`. Form submission state is managed natively via Signal Forms `signInForm().submitting()`.
   - On valid submit:
     - Clear `errorMessage.set(undefined)`.
     - Pass typed credentials: `await this.authService.signIn({ email, password })`.
     - On success: close dialog (`this.dialogRef.close()`) and navigate to `/dashboard` (`await this.router.navigate([APP_LINKS.DASHBOARD])`).
     - On error: catch error, map to user-friendly message, and set `errorMessage.set(message)`.
5. **Tailwind CSS v4 Component Styles (`sign-in-modal.component.css`)**:
   - Include `@reference "../../../../styles.css";` and use `@apply` utility classes for layout, surface cards, and buttons.

## Acceptance Criteria

- [x] `CloseIconComponent` created as a zero-dependency SVG standalone component in `src/app/shared/ui/icons/` matching the project icon standard with unit test coverage.
- [x] Implemented as an accessible CDK Dialog with full keyboard focus trapping and Escape/backdrop dismissal.
- [x] Matches visual specifications from `DESIGN.md` Section 13, Desktop screen `57acb0b8ea9b41869ca631da97962637`, and Mobile screen `3cdd32fdeb4e4c0b8d2cd236f382c8e2`.
- [x] Pure Signal Forms implementation with live email/password field validation.
- [x] Displays friendly error alert when sign-in fails.
- [x] Submitting successfully authenticates, closes the dialog, and navigates to `/dashboard`.
- [x] Unit tests cover validation rules, submission success, and error display with 100% assertion coverage.
