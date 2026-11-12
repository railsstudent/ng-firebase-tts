# 02: Extend Vision Preprocessing with `imageBytes` and Update Vision Domain Interfaces

**What to build:**
Extend **Vision Payload Preprocessing** (`preprocessImageForVision` and `ImageProcessingResult`) to return `imageBytes: Uint8Array` extracted from the already-downscaled (max 768px) WebP/JPEG blob so the on-device classifier can evaluate the compressed image bytes without decoding the original upload twice. Update `src/app/core/vision/image-analysis.interface.ts` to define `ImageSubjectCategory` (`'place' | 'people' | 'general'`), add `category?: ImageSubjectCategory` to `ImageAnalysisResponse`, and add `mapsCitations?: GoogleMapsGroundingChunk[]` to `VisionGroundingMetadata`.

**Blocked by:** None (can start immediately)

**Status:** done

## Target Files

- `src/app/core/vision/image-processing.interface.ts`
- `src/app/core/vision/image.util.ts`
- `src/app/core/vision/image-analysis.interface.ts`
- `src/app/core/vision/image.util.spec.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Add `imageBytes: Uint8Array` to `ImageProcessingResult` (`src/app/core/vision/image-processing.interface.ts`)

- [x] Update `ImageProcessingResult` in `src/app/core/vision/image-processing.interface.ts`:

  ```ts
  export interface ImageProcessingResult {
    data: string;
    mimeType: string;
    imageBytes: Uint8Array;
    optimizationMetrics: ImageOptimizationMetrics;
  }
  ```

### 2. Return `imageBytes` from `preprocessImageForVision()` (`src/app/core/vision/image.util.ts`)

- [x] Update `preprocessImageForVision()` in `src/app/core/vision/image.util.ts` to extract `imageBytes` from `optimizedBlob` alongside `base64Data`:

  ```ts
  export async function preprocessImageForVision(file: File, win?: Window | null): Promise<ImageProcessingResult> {
    const { bitmap, dimensions: originalDimensions } = await decodeSourceBitmap(file, win);
    const optimizedDimensions: Dimensions = calculateTargetDimensions(originalDimensions);
    const { blob: optimizedBlob, mimeType } = await compressBitmapToBlob(bitmap, {
      dimensions: optimizedDimensions,
      fallbackFile: file,
      win,
    });

    const [base64Data, arrayBuffer] = await Promise.all([blobToBase64(optimizedBlob), optimizedBlob.arrayBuffer()]);
    const imageBytes = new Uint8Array(arrayBuffer);
    const optimizationMetrics: ImageOptimizationMetrics = calculateOptimizationMetrics({
      originalSizeBytes: file.size,
      optimizedSizeBytes: optimizedBlob.size,
      originalDimensions,
      optimizedDimensions,
    });

    return {
      data: base64Data,
      mimeType,
      imageBytes,
      optimizationMetrics,
    };
  }
  ```

### 3. Update Vision Domain Interfaces (`src/app/core/vision/image-analysis.interface.ts`)

- [x] Update `src/app/core/vision/image-analysis.interface.ts` to define `ImageSubjectCategory`, add `mapsCitations?: GoogleMapsGroundingChunk[]` to `VisionGroundingMetadata`, and add `category?: ImageSubjectCategory` to `ImageAnalysisResponse`:

  ```ts
  export type ImageSubjectCategory = 'place' | 'people' | 'general';
  ```

  ```ts
  import type { GoogleMapsGroundingChunk, WebGroundingChunk } from 'firebase/ai';
  import type { ImageOptimizationMetrics } from './image-processing.interface';
  import type { ImageSubjectCategory } from './image-category.type';

  export interface VisionGroundingMetadata {
    citations: WebGroundingChunk[];
    mapsCitations?: GoogleMapsGroundingChunk[];
    renderedContent: string;
    searchQueries: string[];
  }

  export interface Recommendation {
    id: number;
    text: string;
    reason: string;
  }

  export interface TokenUsage {
    input: number;
    output: number;
    thought: number;
    total: number;
  }

  export interface ImageAnalysis {
    alternativeText: string;
    tags: string[];
    recommendations: Recommendation[];
    fact: string;
  }

  export interface ImageAnalysisResponse {
    parsed: ImageAnalysis;
    thought: string;
    tokenUsage: TokenUsage;
    metadata: VisionGroundingMetadata;
    optimizationMetrics?: ImageOptimizationMetrics;
    category?: ImageSubjectCategory;
  }
  ```

### 4. Add Unit Tests for `imageBytes` (`src/app/core/vision/image.util.spec.ts`)

- [x] Update `src/app/core/vision/image.util.spec.ts` with Red -> Green test assertions verifying `result.imageBytes`:

  ```ts
  // 1. Inside 'should process image and return base64 and metrics with mock window OffscreenCanvas':
  const result = await preprocessImageForVision(dummyFile, mockWindow);

  expect(result.data).toBeDefined();
  expect(result.mimeType).toBe('image/webp');
  expect(result.imageBytes).toBeInstanceOf(Uint8Array);
  expect(new TextDecoder().decode(result.imageBytes)).toBe('optimized-data');
  expect(result.optimizationMetrics).toBeDefined();

  // 2. Inside 'should safely fallback to raw file when window is null (SSR)':
  const result = await preprocessImageForVision(dummyFile, null);

  expect(result.data).toBeDefined();
  expect(result.mimeType).toBe('image/png');
  expect(result.imageBytes).toBeInstanceOf(Uint8Array);
  expect(new TextDecoder().decode(result.imageBytes)).toBe('ssr-data');
  expect(result.optimizationMetrics.originalDimensions).toEqual({ width: 768, height: 768 });
  ```

### 5. Verification

- [x] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/image.util.spec.ts
  ```
