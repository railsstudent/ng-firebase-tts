# Specification: Firebase Base Integration

## Problem Statement

To enable client-side Firebase and Gen AI capabilities safely and robustly, the application requires a secure, SSR-safe, and resilient connection to Firebase services (Core, App Check, and Remote Config). Without this core integration, the client exposing raw API keys on the web will be vulnerable to unauthorized traffic, and automated Server-Side Rendering (SSR) or Static Site Generation (SSG) compilation builds in our container networks will crash when attempting browser-only Web API integrations.

---

## Solution

A fully protected client-side core Firebase foundation. This includes runtime configuration loading via JSON files, strict client-only initialization of **App Check via reCAPTCHA Enterprise** to guard resources from bot networks, and a dynamic configuration gateway via **Firebase Remote Config** that uses a fail-soft local defaults file during network-absent states or server compilation phases.

---

## User Stories

1. As an application developer, I want Firebase to initialize dynamically from a JSON file, so that environment configuration keys are cleanly separated from compiled source code.
2. As a platform user, I want the application's page to load instantly even under poor network conditions, so that I have a reliable and smooth user experience.
3. As an application deployer, I want build-time SSR static generation to complete successfully without making live Firebase API network calls, so that deployments on Firebase App Hosting are reliable and fast.
4. As an application owner, I want my Gemini API usage budgets to be secure, so that unauthorized scraping or key-cloning bots cannot abuse my Firebase account or raise costs.
5. As a local application developer, I want to bypass security attestation checks automatically on localhost, so that I can work on and test features without manual validation blocks.

---

## Implementation Decisions

### 1. Externalized Runtime Configuration

The Firebase application credentials are not compiled into Angular environment variables. Instead, they are retrieved asynchronously at application start from a static asset file `public/firebase.config.json` generated during build time.

### 2. SSR & Build-Prerender Isolation

All direct Firebase SDK calls (such as App Check attestation queries and Remote Config network syncs) are strictly guarded behind a browser context token (`IS_BROWSER`). When `IS_BROWSER` is false (such as during Node compilation or server rendering), network-calling SDK sequences are completely bypassed, preventing build pipeline timeouts.

### 3. App Check Attestation

- **Production Provider**: Configured exclusively to use **reCAPTCHA Enterprise**.
- **Local Dev Provider**: Falls back to the standard App Check Debug Factory. When a specific debug token variable is defined in the browser window, App Check uses this token to bypass standard captcha challenges.

### 4. Dynamic Remote Configuration

The application leverages Firebase Remote Config to retrieve active environment parameters:

- `geminiModelName`: Active voice/generative model version.
- `vertexAILocation`: Geo-location for Agent Platform calls.
- `thinkingLevel`: Reasoning toggle.
  To ensure robustness, Remote Config is backed by a local JSON file (`public/remote-config-defaults.json`). If the client is offline or the server fails to hit Google APIs, the app immediately soft-falls back to this local structure.

---

## Testing Decisions

### What Makes a Good Test

- Tests must verify the external behavioral properties of the initialization (e.g., that App Check does not throw crashing errors during SSR hydration, and that configurations fallback successfully to local defaults when API servers are unreachable).
- Mocking is utilized at the boundary level (such as mocking the `RemoteConfig` and `FirebaseApp` injection tokens) rather than verifying internal SDK private implementations.

### Modules Tested

- `ConfigService` (`src/app/core/services/config.service.ts`): Verify safe fallback initialization during simulated offline states.

---

## Out of Scope

- Hosting or configuring server-side database endpoints (Firestore / Realtime Database) is currently out of scope for this base integration step.

---

## Further Notes

- This foundational spec ensures that any downstream Gen AI features can inherit a secure, authenticated, and highly stable connection directly from client devices.
