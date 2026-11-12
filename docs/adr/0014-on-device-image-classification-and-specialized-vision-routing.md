# 0014: On-Device Image Classification with MediaPipe Decision Maker and Specialized Vision Routing

- **Status**: Accepted
- **Date**: 2026-11-12

## Context

Previously, `VisionService.analyzeImage()` routed every uploaded photo to a single general-purpose Gemini vision model configured only with `altTextPrompt` and Google Search grounding (`tools: [{ googleSearch: {} }]`). This one-size-fits-all approach produced poor alternative text for two common visual categories:

1. **People and Faces**: Generic alternative text failed to identify recognizable public figures and produced shallow descriptions when human subjects were unknown instead of focusing on facial expressions, gaze, posture, attire, framing, and lighting.
2. **Places and Landmarks**: Generic alternative text omitted the canonical place name and geographic coordinates (latitude and longitude) and lacked access to Google Maps geospatial grounding (`googleMaps` tool).

Calling a cloud LLM twice (once to classify the image category and once to generate the analysis) would double network round-trips and cloud token costs. Instead, we can perform **On-Device Image Classification** locally in the browser using `@mediapipe/tasks-decision` (`DecisionMaker`) and the multimodal **EmbeddingGemma 2** model (`embeddinggemma-2-text-vision-440m.litertlm`) in a single zero-decoding forward pass before dispatching the cloud Gemini request.

## Decision

We introduce an on-device classification stage (`ImageClassifierService`) and route `VisionService.analyzeImage()` across three specialized **Image Subject Categories** (`place`, `people`, `general`):

1. **On-Device Multimodal Classification (`@mediapipe/tasks-decision` + EmbeddingGemma 2)**:
   - `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`) lazily imports `@mediapipe/tasks-decision`, resolves local WASM files via `FilesetResolver.forDecisionTasks('/wasm')`, and initializes `DecisionMaker` (`maxNumTokens: 512`) using `decisionModelPath` from Remote Config.
   - **Delegate Selection (`resolveDelegate`)**: On Web, `.litertlm` containers with external weights (`embeddinggemma-2-text-vision-440m.litertlm`, Gemma 4) require WebGPU (`delegate: 'GPU'`), whereas `.task` / inline `.tflite` models (such as Laya) support both `'GPU'` and `'CPU'`. `ImageClassifierService` inspects `WINDOW.navigator` (`'gpu' in navigator`) and `decisionModelPath`:
     - When WebGPU is available, it selects `delegate: 'GPU'`.
     - When WebGPU is unavailable and `decisionModelPath` ends with `.litertlm`, it fast-fails to `'general'` **before** loading `/wasm` or downloading the `.litertlm` weights.
     - When WebGPU is unavailable and `decisionModelPath` points to a `.task` or `.tflite` model, it falls back to `delegate: 'CPU'`.
   - Rather than decoding the full-resolution upload twice, `preprocessImageForVision()` returns the already-downscaled (max 768px), EXIF-corrected WebP/JPEG `imageBytes: Uint8Array` alongside the Base64 payload, which is passed directly to `DecisionMaker.evaluateChoice({ imageBytes }, choiceQuestion)`.
   - The `ChoiceQuestion` (`normalizePrior: true`) is prewarmed once per session and defines three mutually exclusive criteria (`place`, `people`, `general`) where recognizable landmarks/places take precedence over human subjects (so tourist selfies in front of landmarks route to `place`).
   - **Error Handling**: If model initialization rejects, `#decisionMakerPromise` resets to `null` (so subsequent photo uploads can retry after transient network errors), logs `console.warn`, and returns `'general'`. If a single `evaluateChoice()` call fails after initialization, it logs `console.warn` and returns `'general'` while keeping the prewarmed `DecisionMaker` instance cached. Whenever the winning choice confidence is below `decisionConfidenceThreshold` (default `0.4` in Remote Config), classification also returns `'general'`.

2. **Local WASM Asset Serving & Lazy Service Worker Caching**:
   - `angular.json` maps `node_modules/@mediapipe/tasks-decision/wasm` to `/wasm` in the build output.
   - `ngsw-config.json` includes `/wasm/**` under the `lazy` `assets` group so WASM binaries are never prefetched during initial app startup and are cached on first use.

3. **Remote Config Parameters (`decisionModelPath` & `decisionConfidenceThreshold`)**:
   - `public/remote-config-defaults.json`, `firebase/remote-config-template.json`, `AppRemoteConfig`, and `ConfigService` define:
     - `decisionModelPath`: `"https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm"`
     - `decisionConfidenceThreshold`: `"0.4"` (resolved as numeric `0.4` in `ConfigService.appConfig`).

4. **Specialized Gemini Model Routing & Tool Combinations**:
   - **`people`**: Uses a portrait/human-subject `systemInstruction` (`peopleSystemInstruction`), `peopleAltTextPrompt` (identifying recognizable public figures by name and context, or describing facial expression/emotion, gaze direction, pose/action, attire/accessories, framing, and lighting/background when unknown), and `tools: [{ googleSearch: {} }]`.
   - **`place`**: Uses a geographical/landmark `systemInstruction` (`placeSystemInstruction`), `placeAltTextPrompt` (weaving the **Place Name** and **Latitude / Longitude** inline into `alternativeText` without fabricating coordinates if unverified), and `tools: [{ googleMaps: {} }, { googleSearch: {} }]` (Google Maps grounds place identity/location globally without browser geolocation `toolConfig` bias; Google Search grounds the interconnecting **Obscure Fact**).
   - **`general`**: Retains the existing `altTextPrompt`, no `systemInstruction`, and `tools: [{ googleSearch: {} }]`.
   - All three routes share `ImageAnalysisSchema` and leverage `AiModelFactory`'s deterministic composite cache key (`${geminiModelName}_${thinkingLevel}_${instruction}_${schemaKey}_${toolsKey}`).

5. **UI Category Badge & Compliant Google Maps Attribution**:
   - `ImageAnalysisResponse` includes `category?: ImageSubjectCategory`, rendered as a CSS `.category-badge` pill next to _"Generated Alternative Text"_ in `AltTextPanel` using `@theme` design tokens.
   - `VisionService.constructCitations()` extracts `GoogleMapsGroundingChunk` entries (`chunk.maps`) into `VisionGroundingMetadata.mapsCitations`, and `GroundingComponent` renders a **Google Maps Sources** section with compliant `<span translate="no" class="gmp-attribution">Google Maps</span>` attribution.

## Consequences

- **Positive**: Produces domain-tailored alternative text (public figure recognition or rich human-feature descriptions for `people`; landmark coordinates + place names for `place`) in a single cloud Gemini call per analysis.
- **Positive**: Serving WASM from `node_modules` with lazy Service Worker caching and `injectAsync` boundary isolation adds zero bytes to `main.js`.
- **Trade-off**: `embeddinggemma-2-text-vision-440m.litertlm` (~388 MB) requires WebGPU (`delegate: 'GPU'`) on Web; devices or browsers without WebGPU automatically degrade to the `'general'` Gemini model without breaking image analysis.
