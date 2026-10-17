# 01: Consolidated Single-Secret Sync with Idempotency, Pruning, and Build Integration

**What to build:** Refactor Firebase App Hosting secret management to use a single consolidated JSON secret (`app_firebase_config`) containing the SDK configuration and reCAPTCHA Enterprise key. Maintain idempotency via diff-checking before write, and automatically prune older versions upon rotation. Update `apphosting.yaml` and `generate-firebase-config.mjs` to unpack this single secret during App Hosting Cloud Build, and clean up obsolete individual secrets in Google Cloud.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Update `apphosting.yaml` to declare a single secret reference: `APP_FIREBASE_CONFIG` mapping to secret `app_firebase_config`.
- [x] Refactor `firebase/scripts/deploy-apphosting-secrets.mjs` to bundle Firebase SDK config and reCAPTCHA Enterprise key into a unified JSON payload for `app_firebase_config`.
- [x] Implement diff-checking in `deploy-apphosting-secrets.mjs` via `npx firebase apphosting:secrets:access app_firebase_config` to skip write when the cloud payload matches the local bundle.
- [x] Implement automatic pruning in `deploy-apphosting-secrets.mjs` to destroy previous versions upon secret update, ensuring $\le 1$ active version.
- [x] Update `firebase/scripts/generate-firebase-config.mjs` Cloud Build `else` block to parse `process.env.APP_FIREBASE_CONFIG` (preserving local `.env` development flow).
- [x] Destroy the 7 deprecated individual secrets (`firebase_api_key`, `firebase_auth_domain`, etc.) in Google Cloud Secret Manager to reclaim quota.
- [x] Verify that running `npm run config:secrets` creates zero redundant versions when unchanged, and `npm run build` succeeds locally and in production simulation.
