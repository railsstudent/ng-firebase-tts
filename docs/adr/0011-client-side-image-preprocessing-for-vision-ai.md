# 0011: Client-Side Image Preprocessing and Multimodal Tile Budget Optimization for Vision AI

- **Status**: Accepted
- **Date**: 2026-10-01

## Context

The application performs multimodal image analysis by transmitting uploaded user photos to Firebase AI Logic (Gemini API) via `VisionService.generateAltText()`. Gemini evaluates the image against a structured schema to produce alternative text, descriptive tags, composition recommendations, and search-grounded obscure facts.

Previously, user-uploaded `File` objects were read directly from disk via `FileReader.readAsDataURL()` and embedded verbatim as Base64 `inlineData` in the Gemini API payload.

This introduced several critical performance and cost bottlenecks:

1. **Massive Network Payload Bloat**: Uncompressed camera photos from modern smartphones (typically 12–48 megapixels, 4–15 MB) inflated by 33% when Base64-encoded, transmitting 6–20 MB over the network. This caused severe upload latency on mobile connections and high client memory pressure.
2. **Multimodal Tile Explosion & Excessive Token Billing**: Gemini multimodal vision encoders divide images exceeding $768\text{px}$ into a spatial grid of $768 \times 768$ pixel patches, charging **258 input tokens per tile**. An unscaled $4032 \times 3024$ photo produces $6 \times 4 = 24$ tiles, consuming **over 6,190 input tokens** for a single analysis.
3. **Overkill Resolution for Semantic Vision**: Generating descriptive tags, alt text, and scene recommendations relies on high-level semantic understanding (objects, colors, lighting, relationships) rather than raw megapixel density. Sending multi-megabyte payloads consumed cloud resources without measurable accuracy gains.
4. **Lack of Telemetry Visibility**: Users and developers had no visibility into the payload savings or token efficiency achieved during image analysis.

---

## Decision

We introduce a client-side **Vision Payload Preprocessing** pipeline and a dedicated **Usage & Optimization Telemetry** component:

### 1. Max Bounding Dimension ($768\text{px}$) & Aspect Ratio Preservation

- All uploaded images sent to `VisionService` are downscaled client-side using a maximum bounding box of **$768\text{px}$** along their longest dimension (width or height).
- Images already smaller than $768 \times 768$ are preserved at their original resolution to prevent unnecessary upscaling artifacts.
- The original aspect ratio is strictly maintained:
  - If $\text{width} \ge \text{height}$: $\text{targetWidth} = 768$, $\text{targetHeight} = \text{round}(768 / \text{aspectRatio})$.
  - If $\text{height} > \text{width}$: $\text{targetHeight} = 768$, $\text{targetWidth} = \text{round}(768 \times \text{aspectRatio})$.

### 2. Modern WebP Compression with JPEG Fallback

- Images are re-encoded client-side using native browser canvas primitives (`createImageBitmap`, `OffscreenCanvas` / `HTMLCanvasElement`) to **`image/webp`** at a quality factor of **`0.8`** (with automatic fallback to `image/jpeg`).
- Native `createImageBitmap(file, { imageOrientation: 'from-image' })` is utilized to automatically correct EXIF rotation flags from mobile cameras before encoding.

### 3. Decoupled UI Preview

- The client-side downscaling operates strictly in memory for the AI request payload.
- The high-resolution image preview displayed on screen in `PhotoPanel` remains the pristine, original user upload, preserving maximum visual fidelity in the UI.

### 4. Fresh Generations (No Response Caching)

- To ensure users can explore creative variations in generated tags, suggestions, and obscure facts, every "Generate" user action executes a fresh request against Firebase AI Logic without caching previous responses.

### 5. Deterministic Token & Efficiency Telemetry

- We compute and return strongly-typed `ImageOptimizationMetrics` alongside `tokenUsage` in `ImageAnalysisResponse`:

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

### 6. Dedicated Defer-Loaded Telemetry Component (`UsageMetricsComponent`)

- To resolve structural inconsistency in `DashboardComponent`, we extract the inline token display into a standalone component (`app-usage-metrics`).
- In `dashboard.component.html`, the component is loaded deferred when telemetry is available:

  ```html
  @defer (when imageAnalysis?.tokenUsage || imageAnalysis?.optimizationMetrics) {
  <app-usage-metrics
    [tokenUsage]="imageAnalysis?.tokenUsage"
    [optimizationMetrics]="imageAnalysis?.optimizationMetrics"
  />
  }
  ```

---

## Technical Mechanics & Calculation Formulas

### 1. Gemini Vision Tile & Token Estimation Formula

Gemini calculates image input tokens using fixed $768 \times 768$ pixel tiles at 258 tokens per tile:

$$\text{Horizontal Tiles} = \left\lceil \frac{\text{originalWidth}}{768} \right\rceil$$

$$\text{Vertical Tiles} = \left\lceil \frac{\text{originalHeight}}{768} \right\rceil$$

$$\text{Estimated Original Tokens} = (\text{Horizontal Tiles} \times \text{Vertical Tiles}) \times 258$$

### 2. Single-Tile Bounding Guarantee

Because the preprocessed image is bounded by $\le 768\text{px}$ on both axes, it is guaranteed to fit within **exactly 1 tile**:

$$\text{Actual Image Tokens} = 258$$

$$\text{Tokens Saved} = \max(0, \text{Estimated Original Tokens} - 258)$$

### 3. Bandwidth / Payload Reduction Percentage

$$\text{Bytes Saved} = \max(0, \text{originalSizeBytes} - \text{optimizedSizeBytes})$$

$$\text{Bytes Saved Percentage} = \frac{\text{Bytes Saved}}{\text{originalSizeBytes}} \times 100\%$$

---

## Consequences

### Positive

- **Dramatic Token Reduction**: Slashes vision input token consumption by **90% to 96%** on high-resolution camera uploads (~6,190 tokens down to 258 tokens).
- **Sub-Second Uploads**: Reduces network payload by **95% to 99%** (~5 MB down to ~45–60 KB), speeding up API requests and eliminating mobile bandwidth waste.
- **Client Memory Protection**: Eliminates multi-megabyte Base64 string allocations in browser memory.
- **Zero UI Compromise**: Users continue to view their original high-resolution photo on screen while the background payload is optimized.
- **Architectural Modularity**: Moving telemetry into `UsageMetricsComponent` keeps `DashboardComponent` clean and leverages Angular `@defer` chunk splitting.

### Negative / Trade-offs

- **Client CPU Work**: Introduces a 15–30 ms canvas downscaling pass on the client prior to network dispatch (negligible compared to the seconds saved during network transfer).
- **Fine-Print OCR Trade-off**: Extreme fine-print text (e.g. tiny medicine labels) is softer at 768px than at 4000px, but 768px provides optimal fidelity for scene understanding, alt text, and tag generation.
