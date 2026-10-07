# Specification: Firebase Authentication & Session Management

**Status**: `ready-for-agent`

## Problem Statement

Currently, any visitor landing on the application can immediately access the TTS Studio Workspace without logging in. This exposes serverless Vertex AI and speech generation compute resources without any user authorization. Furthermore, the Home Screen lacks any visual distinction between authenticated and unauthenticated states, offers no way to sign in, and the application header provides no mechanism for a user to safely sign out.

## Solution

Provide a secure, streamlined client-side authentication experience powered by Firebase Authentication with Email and Password. The landing page adapts dynamically: unauthenticated visitors see a prominent "Sign In" button, while authenticated users see the "Launch Studio" button to access the workspace. Clicking "Sign In" opens an accessible, lightweight dialog. The session is scoped to the browser tab, ensuring privacy when closing the browser while allowing seamless page reloads. The application header displays an accessible Sign-Out button whenever a session is active, and direct navigation to the workspace is guarded against unauthorized access.

## User Stories

1. As an unauthenticated visitor on the Home Screen, I want to see a prominent "Sign In" button, so that I can initiate authentication before entering the workspace.
2. As an unauthenticated visitor, I want the initial application bundle to load without downloading heavy authentication libraries or dialog dependencies, so that my first page render is instant.
3. As an unauthenticated user clicking "Sign In", I want an accessible modal dialog to open smoothly, so that I can enter my credentials.
4. As a user in the Sign-In modal, I want to enter my email and password with real-time validation feedback, so that I can see whether my inputs meet basic validity criteria before submitting.
5. As a user submitting credentials, I want to see a loading indicator and disabled inputs during authentication, so that I know my request is processing.
6. As a user entering invalid credentials or experiencing a network failure, I want to see an inline error message explaining the failure, so that I can correct my inputs and retry.
7. As an authenticated user, I want the Sign-In modal to close immediately upon successful authentication and navigate directly to the workspace (`/dashboard`), so that I can immediately begin generating speech.
8. As an authenticated user visiting or returning to the Home Screen, I want to see the "Launch Studio" button instead of the "Sign In" button, so that I can re-enter the TTS Studio Workspace.
9. As an authenticated user viewing any page, I want to see an accessible Sign-Out icon button on the right edge of the application header, so that I have a clear landmark to end my session.
10. As a keyboard user, I want to tab to the Sign-Out icon button and activate it with Enter/Space, so that I can sign out without requiring a mouse.
11. As a screen reader user, I want the Sign-Out button to announce a clear descriptive label ("Sign out"), so that I understand its purpose.
12. As an authenticated user clicking the Sign-Out button, I want my active session to be terminated and to be redirected immediately to the Home Screen, so that my credentials and access are safely revoked.
13. As an unauthenticated user attempting to navigate directly to the workspace (`/dashboard`) via URL or bookmark, I want to be redirected to the Home Screen, so that unauthorized access to AI capabilities is prevented.
14. As an authenticated user refreshing the browser tab (F5) or navigating between Home and Dashboard, I want my active session to persist seamlessly without being forced to sign in again.
15. As a privacy-conscious user, I want my active session to be automatically terminated whenever I close the browser tab or quit the browser, so that subsequent visitors to the machine cannot access my account.
16. As a mobile user, I want the Home Screen action button, Sign-In modal, and header Sign-Out button to fit comfortably on small touch screens with adequate touch targets.
17. As a user closing the modal via the Escape key, close button, or backdrop click, I want the modal to dismiss cleanly without errors and return focus appropriately.

## Implementation Decisions

The system architecture and technical trade-offs are governed by [ADR 0012: Firebase Auth Session Persistence and Deferred Dialog Strategy](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0012-firebase-auth-session-and-lazy-dialog-strategy.md).

### 1. Dynamic Landing View Adaptation

- The Home Screen presents two distinct interactive states:
  - **Unauthenticated**: Renders a primary "Sign In" call-to-action button that triggers the sign-in flow.
  - **Authenticated**: Renders the primary "Launch Studio" button that navigates directly to the workspace.
- Both states share the existing responsive layout structure, dark theme tokens, and feature capability badges.

### 2. Accessible Sign-In Dialog Experience

- An accessible overlay dialog is triggered on demand when the user clicks "Sign In".
- The dialog provides clear Email and Password inputs with real-time field validation, an inline loading spinner on submit, and localized error messages.
- Background scrolling is locked while the dialog is open, keyboard focus is trapped within the dialog, and pressing the Escape key or clicking the backdrop dismisses the dialog.

### 3. Application Header Sign-Out Action

- An accessible standalone SVG Sign-Out icon button is positioned on the right edge of the global application header.
- The button is visible only when an active user session is authenticated.
- Activating the button terminates the active session, clears credentials, and redirects the user back to the Home Screen.

### 4. Workspace Access Control & Tab-Scoped Sessions

- Direct URL access to the studio workspace (`/dashboard`) is protected: unauthenticated navigation attempts are automatically intercepted and redirected to the Home Screen.
- User sessions are scoped to the active browser tab: refreshing the tab or navigating within it preserves the logged-in state, while closing the tab automatically logs out the user.

---

## Testing Decisions

All automated and manual verifications are formulated in natural language around **observable user behaviors, security boundaries, and real-world stakeholder scenarios**:

### 1. Visitor Entry & Instant Load Experience

- **Cold Visitor Journey**: When an unauthenticated visitor opens the website for the first time, the landing page must render instantly without downloading unused authentication libraries in the background. The hero section must clearly show the "Sign In" button, and no sign-out control appears in the header.
- **Security Check on Direct URL Entry**: When an unauthenticated user tries to bypass the landing page by typing `/dashboard` directly into the browser's address bar or opening a bookmark, the application must immediately block access and send them back to the Home Screen.

### 2. Sign-In Workflow & Form Interactivity

- **Modal Opening & Accessibility**: When a user clicks "Sign In", the modal dialog must appear smoothly over the page, lock background scrolling, trap keyboard focus within the dialog, and be properly announced to screen readers.
- **Form Validation Feedback**: When a user types an invalid email format or leaves the password empty, the form must provide clear, friendly validation guidance and keep the submit action disabled.
- **Processing & Loading Feedback**: When the user submits valid credentials, a loading spinner must appear, inputs must be temporarily disabled to prevent accidental double-clicks, and the authentication request is processed.
- **Error Handling**: When incorrect credentials are provided (e.g. wrong password or unregistered email), a clear, non-technical error alert must be displayed directly inside the modal so the user can easily re-type their information.
- **Dismissal & Cancellation**: When the user presses the Escape key, clicks the close 'X' button, or clicks outside the dialog area, the modal must close cleanly and return focus to the Home Screen without errors.

### 3. Authenticated State & Workspace Access

- **Immediate State Transition**: When sign-in completes successfully, the modal must close automatically and navigate the user directly into the multimodal TTS workspace (`/dashboard`).
- **Returning to Home Screen**: When an authenticated user navigates back to the Home Screen (or refreshes the page), the Home Screen must display the "Launch Studio" button instead of "Sign In", and the Sign-Out icon button must appear in the top-right header.
- **Entering the Studio**: When an authenticated user clicks "Launch Studio", the user must be smoothly navigated into the multimodal TTS workspace.

### 4. Session Persistence & Logout Privacy

- **Page Refresh Resilience**: When an authenticated user refreshes their browser tab (F5) or navigates back and forth between Home and Dashboard, their session must be seamlessly remembered without requiring them to log in again.
- **Safe Logout**: When an authenticated user clicks the Sign-Out icon in the header, their session must be immediately cleared, they must be redirected to the Home Screen, the Sign-Out button must disappear, and the landing page must return to the "Sign In" state.
- **Tab Closure Privacy Guarantee**: When a user closes the browser tab or quits the browser window, the temporary session must be wiped, ensuring that reopening the application starts fresh in a logged-out state.

---

## Out of Scope

- In-app self-service user registration / sign-up forms (user accounts are managed directly by administrators in the Firebase Console).
- "Forgot Password" or password reset email flows.
- Multi-factor authentication (MFA) or social logins (Google, Apple, GitHub).
- User profile editing, avatar uploads, or account settings screens.

---

## Further Notes

- UI designs for desktop and mobile viewports are modeled via Stitch MCP before frontend implementation.
- All domain terminology conforms to [`GLOSSARY.md`](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/GLOSSARY.md).
