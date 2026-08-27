# 0002: Firebase Integration, App Check, and SSR Security Strategy

- **Status**: Accepted
- **Date**: 2026-08-28

## Context

Our application relies on Firebase services as its backend architecture. Because client-side web applications expose API keys in their network requests, we must secure our endpoints against unauthorized quota theft, crawling, and API abuse (particularly on billing-sensitive Gen AI endpoints). Additionally, because we support Server-Side Rendering (SSR) and automated build prerendering (such as Firebase App Hosting cloud compilations), the app boot process must not crash when running in Node.js environments where browser elements are absent.

## Decision

We will establish a secure, SSR-safe Firebase core architecture using runtime configurations, dynamic Remote Config defaults, and App Check protection:

1. **Dynamic Config Loading**: Load project credentials asynchronously at runtime from `public/firebase.config.json` instead of hardcoding them into compiling environments.
2. **App Check Protection**:
   - Initialize App Check using the **reCAPTCHA Enterprise** provider for web clients.
   - Support zero-friction developer testing by loading pre-registered App Check debug tokens from `.env` (packaged into `firebase.config.json`) and assigning the explicit string directly to `self.FIREBASE_APPCHECK_DEBUG_TOKEN`. This avoids the manual console-registration overhead that setting the value to `true` (auto-generating fresh tokens) would require on every developer session.
   - Defer App Check initialization entirely if `IS_BROWSER` is false (during SSR/compile) to prevent server-side failures.
3. **Resilient Remote Config**:
   - Register a local fallback configuration `public/remote-config-defaults.json` checked into Git.
   - If `fetchAndActivate()` fails during build prerendering or due to user offline states, the app catches the error and utilizes the local fallback file gracefully.

## Consequences

### Positive

- High security posture protecting Google Cloud API budgets from bot networks.
- Safe, compile-friendly, non-crashing build adapter compilation during automated Firebase App Hosting builds.
- Seamless developer testing via automated App Check debug tokens.

### Negative / Trade-offs

- Slight initialization overhead during app startup as configurations are resolved and fetched.
