# 02: ADR 0007 Amendment & Multi-Project Cost Economics

**What to build:** An amendment to `docs/adr/0007-app-hosting-secret-management-strategy.md` documenting the billing incident postmortem, Secret Manager billing mechanics, the evolution from 7 1:1 secrets to a single consolidated JSON secret (`app_firebase_config`), and the multi-project economics enabling up to 6 Firebase projects to run under the GCP free tier ($0.00/month).

**Blocked by:** 01: Consolidated Single-Secret Sync with Idempotency, Pruning, and Build Integration

**Status:** completed

- [x] Amend `docs/adr/0007-app-hosting-secret-management-strategy.md` with an Incident Postmortem & Cost Dynamics section.
- [x] Document the mathematical explanation of Secret Manager version charges ($0.06 USD/version/mo above 6 free tier versions across the billing account).
- [x] Detail the architectural evolution: why bundling public client config into 1 consolidated JSON secret reduces secret consumption by 85% and eliminates billing traps.
- [x] Document multi-project scaling economics (6 distinct web apps supported for $0.00/mo under free tier).
- [x] Document the single-version retention invariant and automated lifecycle pruning.
- [x] Provide CLI inspection commands for developers to verify active secret version counts.
