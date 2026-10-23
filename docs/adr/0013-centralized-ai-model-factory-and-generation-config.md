# 0013: Centralized Generative Model Factory, Lifecycle Caching, and Request-Level GenerationConfig Protocol

- **Status**: Accepted
- **Date**: 2026-10-23

## Context

Previously, `VisionService` and `TextToSpeechService` each invoked `getGenerativeModel()` directly on every inference call:

1. **Redundant Instantiation**: Every `analyzeImage()`, `synthesize()`, or `synthesizeStream()` call constructed a brand-new `GenerativeModel` instance even when the underlying `AI` backend and model configuration had not changed.
2. **Duplicated Model Setup**: Safety settings, thinking configuration, and `firebase/ai` imports were scattered across individual domain services.
3. **SDK Shallow-Spread Pitfall in `generateContent`**: In the `@firebase/ai` Web SDK, `GenerativeModel.generateContent(request)` and `generateContentStream(request)` combine model defaults with per-request parameters via shallow object spread (`{ generationConfig: this.generationConfig, ...formattedParams }`). Passing `generationConfig: { speechConfig }` in a request completely overwrites `this.generationConfig`, dropping `responseModalities: [ResponseModality.AUDIO]` unless `...model.generationConfig` is spread into the request's `generationConfig`.

## Decision

We introduce a centralized `AiModelFactory` (`src/app/core/firebase/ai-model-factory.service.ts`) governed by four invariants:

1. **Lazy Factory Injection & Dynamic SDK Import**: Domain services (`VisionService`, `TextToSpeechService`) resolve `AiModelFactory` on demand via Angular's `injectAsync(() => import('@/core/firebase/ai-model-factory.service').then((m) => m.AiModelFactory))`, and `AiModelFactory` loads `firebase/ai` via dynamic `await import('firebase/ai')` inside `createModel()` and `createTtsModel()`, preserving ADR-0008 service-level code splitting so `firebase/ai` never enters the initial critical bundle.
2. **Deterministic Generative Model Map Cache**: Models are cached in a private `Map<string, GenerativeModel>` (`#models`) keyed by `${model}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}` in that exact order, separated by underscores (`_`). `model` and `thinkingLevel` are resolved from `ConfigService.appConfig` (`geminiModelName` and `thinkingLevel`), `tools` are attached only when explicitly provided in `options.tools`, and `responseSchema` and `responseMimeType: 'application/json'` are attached conditionally and cleanly only when a schema is provided.
3. **Single Cached TTS Model with Request-Level Spread**: `AiModelFactory` caches a single `#ttsModel` configured with `generationConfig: { responseModalities: [ResponseModality.AUDIO] }`. Callers (`TextToSpeechService`) pass dynamic voice configurations per request by spreading `...model.generationConfig` alongside `speechConfig` inside `generateContent` and `generateContentStream`.
4. **Automatic Eviction on Backend Rotation**: `AiModelFactory` tracks `#cachedBackend: AI | null`. Whenever `ConfigService.getAiBackend()` returns a new `AI` reference (such as after Remote Config activation resets `#ai = null`), `AiModelFactory` flushes `#models.clear()` and resets `#ttsModel = null`.

## Consequences

- **Positive**: Eliminates per-request `GenerativeModel` allocation overhead across general multimodal, structured output, and TTS workflows while supporting multiple structured schemas, tool combinations (Search, Maps, custom functions), and dynamic TTS voices on cached model instances.
- **Positive**: Centralizes safety settings, thinking config, and Remote Config cache invalidation in `@/core/firebase`.
- **Guardrail**: Any service passing request-level `generationConfig` overrides to a cached `GenerativeModel` must spread `...model.generationConfig` so baseline model properties (such as `responseModalities`) are preserved.
