# Specification: Client-Side Image Preprocessing & Usage Metrics

**Status**: `ready-for-agent`

## Problem Statement

When users upload multi-megapixel camera photos (typically 4–15 MB) for multimodal image analysis in the TTS Studio Workspace, raw uncompressed data is read via `FileReader` and embedded directly as Base64 into the Gemini API payload.

This causes two major issues:

1. **Network Latency & Mobile Data Waste**: Uploading 6–20 MB Base64 payloads over mobile networks causes severe upload lag and high browser memory pressure.
2. **Gemini Vision Token Explosion**: Gemini breaks images exceeding 768px into 768x768 tiles at 258 tokens per tile. An unscaled 12MP photo costs over 6,190 input tokens instead of the single-tile baseline of 258 tokens, without providing noticeable accuracy improvements for tag generation, alt text, or recommendations.
3. **Inconsistent UI Architecture & Lack of Telemetry**: Token usage is currently rendered inline within `DashboardComponent` rather than in a dedicated modular component, and users have no visibility into the payload savings or token efficiency achieved.

---

## Solution

Implement a client-side **Vision Payload Preprocessing** pipeline and a dedicated **Usage & Optimization Telemetry** component:

1. Downscale uploaded photos to a maximum bounding dimension of **768px** (preserving aspect ratio) and compress to **WebP** (`quality: 0.8`) with JPEG fallback using native browser canvas primitives (`createImageBitmap` + `OffscreenCanvas` / `HTMLCanvasElement`).
2. Decouple the UI preview (which retains the pristine original user photo in `PhotoPanel`) from the background AI request payload.
3. Automatically derive deterministic **Image Optimization Metrics** (payload bytes saved, percentage reduction, estimated original tokens, and tokens saved).
4. Extract the inline token display into a standalone, defer-loaded **`UsageMetricsComponent`** that renders both Token Usage and Optimization Efficiency.

---

## User Stories

1. **As a mobile user**, I want my uploaded photo to upload rapidly without consuming megabytes of cellular data, so that image analysis is fast and responsive.
2. **As a user**, I want to see my original, high-resolution photo in the on-screen preview without blurriness, even though a compressed copy is sent to the AI in the background.
3. **As a cost-conscious developer**, I want image payloads constrained to a single Gemini vision tile (258 tokens), so that multimodal AI token usage is minimized.
4. **As an application user**, I want to see how much data and how many tokens were saved by the image optimizer directly in the UI alongside my analysis results.
5. **As an application user**, I want each click on "Generate" to produce fresh AI results with diverse tags, alternative texts, and obscure facts without stale response caching.
6. **As a user with a slow device or connection**, I want the telemetry component to load on demand (`@defer`), so that the initial page bundle remains lightweight.
7. **As an accessibility-focused user**, I want high-quality alt text and scene recommendations generated reliably regardless of whether I upload landscape, portrait, or square photos.

---

## Types, Interfaces & Data Models

### 1. `ImageOptimizationMetrics`

Located in `src/app/core/interfaces/image-analysis.interface.ts`:

```typescript
export interface ImageOptimizationMetrics {
  readonly originalSizeBytes: number;
  readonly optimizedSizeBytes: number;
  readonly originalDimensions: { width: number; height: number };
  readonly optimizedDimensions: { width: number; height: number };
  readonly estimatedOriginalTokens: number;
  readonly actualImageTokens: number;
  readonly tokensSaved: number;
  readonly bytesSavedPercent: number;
}
```

### 2. `ImageAnalysisResponse` Update

Located in `src/app/core/interfaces/image-analysis.interface.ts`:

```typescript
export interface ImageAnalysisResponse {
  parsed: ImageAnalysis;
  thought: string;
  tokenUsage: TokenUsage;
  metadata: GroundingMetadata;
  optimizationMetrics?: ImageOptimizationMetrics;
}
```

---

## Behavioral Requirements & Domain Contracts

### 1. Image Preprocessing Pipeline (`src/app/core/utils/image.util.ts`)

- **Public Contract**: Provides `preprocessImageForVision(file: File, options?: CompressOptions)` and `formatFileSize(bytes: number)`.
- **Dimension Bounding Rule**: Any image with width or height $> 768\text{px}$ must be scaled down preserving aspect ratio so that max dimension is $768\text{px}$. Images $\le 768\text{px}$ maintain original dimensions without upscaling.
- **Canvas Compression Rule**: Renders image via browser canvas primitives (`createImageBitmap` + `OffscreenCanvas` with `HTMLCanvasElement` fallback) to `image/webp` (`quality: 0.8`) with fallback to `image/jpeg`. Returns raw Base64 data without data-URL header.
- **Optimization Telemetry Rule**: Calculates deterministic `ImageOptimizationMetrics` comparing original dimensions/bytes with optimized output, including estimated token savings based on Gemini's $768\times 768$ tile formula (258 tokens per tile).

### 2. `src/app/core/services/vision.service.ts` (Modified Service)

- **`generateAltText(image: File): Promise<ImageAnalysisResponse>`**:
  - Invokes `preprocessImage(image)` to obtain the optimized `inlineData` and `optimizationMetrics`.
  - Dispatches `inlineData` to `aiModel.generateContent([altTextPrompt, inlineData])`.
  - Attaches `optimizationMetrics` to the returned `ImageAnalysisResponse`.

### 3. `src/app/features/dashboard/components/usage-metrics/` (New Component)

- **`usage-metrics.component.ts`**:
  - `tokenUsage = input<TokenUsage | undefined>()`
  - `optimizationMetrics = input<ImageOptimizationMetrics | undefined>()`
- **`usage-metrics.component.html`**:
  - Renders **Text Generation Token Usage** grid if `tokenUsage()` exists.
  - Renders **Image Optimization Efficiency** card (Original vs. Optimized Size, Payload Saved %, Estimated vs. Actual Tokens, Dimensions) if `optimizationMetrics()` exists.
- **`usage-metrics.component.css`**:
  - Styled with Tailwind CSS v4 `@apply` rules referencing `../../../../../styles.css`.

### 4. `src/app/features/dashboard/dashboard.component.html` (Modified Template)

- Replaces inline `.usage-section` markup with:

  ```html
  @defer (when imageAnalysis?.tokenUsage || imageAnalysis?.optimizationMetrics) {
  <app-usage-metrics
    [tokenUsage]="imageAnalysis?.tokenUsage"
    [optimizationMetrics]="imageAnalysis?.optimizationMetrics"
  />
  }
  ```

---

## Testing Decisions & Seam Matrix

### 1. `image.util.spec.ts`

- **Small Image ($\le 768\text{px}$)**: Verify dimensions are preserved without upscaling; 1 tile estimated, 1 actual, 0 tokens saved.
- **Landscape Image ($4000 \times 2000$)**: Verify scaled to $768 \times 384$; 18 tiles estimated, 1 actual, 4,386 tokens saved.
- **Portrait Image ($1500 \times 3000$)**: Verify scaled to $384 \times 768$; 8 tiles estimated, 1 actual, 1,806 tokens saved.
- **Square Image ($2000 \times 2000$)**: Verify scaled to $768 \times 768$; 9 tiles estimated, 1 actual, 2,064 tokens saved.
- **Exact Dimension Match ($768 \times 768$)**: Verify output is $768 \times 768$, 1 tile, 0 tokens saved.
- **Byte Savings & Percentages**: Verify percentages handle zero savings without `NaN` or negative numbers.
- **Base64 Formatting**: Verify returned string contains no data URL prefix.
- **Error Handling**: Verify corrupted/invalid files reject with a clear `Error`.

### 2. `vision.service.spec.ts`

- Verify preprocessed `inlineData` is dispatched to Gemini model.
- Verify `optimizationMetrics` are returned in `ImageAnalysisResponse`.
- Verify missing `image` parameter throws an error.

### 3. `usage-metrics.component.spec.ts`

- Verify renders both Token Usage and Optimization Efficiency cards when both inputs are provided.
- Verify renders only Token Usage when `optimizationMetrics` is undefined.
- Verify renders only Optimization Efficiency when `tokenUsage` is undefined.
- Verify renders cleanly without errors when both inputs are undefined.

### 4. `dashboard.component.spec.ts`

- Verify `@defer` resolves and renders `<app-usage-metrics>` when analysis data is present.

---

## Out of Scope

- Dedicated Web Worker integration (`tsconfig.worker.json` / worker thread message passing) — deferred to future batch image workload enhancements.
- Response deduplication / caching — each user action must invoke fresh AI generation.
- Server-side image resizing via Cloud Functions.

---

## Related Documents

- **ADR**: `docs/adr/0011-client-side-image-preprocessing-for-vision-ai.md`
- **Glossary**: `CONTEXT.md`
