# 0003: Regional Compliance and Native Voice Generation via Agent Platform

- **Status**: Accepted
- **Date**: 2026-08-28

## Context

Our application targets international users, including those in **Hong Kong**. Standard Gemini Developer API keys are geographically restricted and fail in Hong Kong. Therefore, we must use the **Agent Platform Gemini API (Vertex AI for Firebase)** which remains fully available.

Furthermore, we require Text-to-Speech (TTS) capabilities to synthesize vocalizations of generated facts. Traditional TTS approaches require integrating external Cloud Functions, writing server-side Node handlers, or paying for third-party Speech APIs, adding substantial codebase weight and latency.

## Decision

We will utilize the **Agent Platform Gemini API (Vertex AI)** as our long-term Gen AI and Text-to-Speech backbone:

1. **Regional Routing**: Initialize generative models via `AgentPlatformBackend` pointing to unrestricted regions (e.g., `asia-east1`).
2. **Native Text-to-Speech Generation**: Bypass separate voice APIs and leverage Gemini's native audio capabilities by invoking the model with:
   - `responseModalities: ["audio"]`
   - `speechConfig` containing a prebuilt voice setting (e.g., `voiceName: "Kore"` or `"Puck"`).
3. **Structured Flow**: Run image analysis and search grounding, and immediately pass the result into our native audio-generating Gemini configuration to play the synthesized base64 voice payload directly in the browser.

## Consequences

### Positive

- **Zero Server-Side Maintenance**: TTS is handled completely client-side via the Firebase Web SDK, eliminating Cloud Functions, server billing, and custom backend infrastructure.
- **Client-Side Decoding & Memory Playback**: Decoding the raw base64 audio string directly into an ArrayBuffer via Web Audio API means the app doesn't need to write temporary files to cloud storage, completely avoiding transient file accumulation, disk cleanups, and storage costs.
- **Full Regional Compliance**: Routable via safe regional clusters (e.g., `asia-east1`) guaranteeing zero-block access for users in Hong Kong.
- **Robust Schema Matching**: Forcing Gemini to output structural JSON matching our schema prevents model hallucination or UI rendering failures.

### Negative / Trade-offs

- Requires the Firebase project to be on the **Blaze pay-as-you-go** billing plan.
