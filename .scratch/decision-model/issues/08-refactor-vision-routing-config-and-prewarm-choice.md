# 08: Refactor Vision Category Routing Configuration and Use `prewarmChoice` in `ImageClassifierService`

**What to build:**
Simplify the `src/app/core/vision/` domain module by:

1. Replacing `decisionMaker.prewarm({ ... })` in `ImageClassifierService.initializeDecisionMaker()` with `decisionMaker.prewarmChoice(IMAGE_CATEGORY_QUESTION)` so choice options and context are prewarmed directly for `evaluateChoice()` without reconstructing a duplicate schema object.
2. Renaming `vision.prompt.ts` to `vision.const.ts` and exporting a single `CATEGORY_MODEL_CONFIGS: Record<ImageSubjectCategory, CategoryModelConfig>` lookup map (keeping the 5 prompt and system instruction strings module-private), removing the `getCategoryModelConfig()` `switch` method from `VisionService`.
3. Narrowing `src/app/core/vision/index.ts` to export only the public types consumed outside `src/app/core/vision/` (`VisionGroundingMetadata`, `ImageAnalysisResponse`, `TokenUsage`, `Recommendation`, `ImageOptimizationMetrics`) and updating `src/testing/image-classifier.mock.ts` to import `ImageSubjectCategory` directly from `@/core/vision/image-category.type`.

**Blocked by:** None (can start immediately)

**Status:** done

## Target Files

- `src/app/core/vision/index.ts`
- `src/testing/image-classifier.mock.ts`
- `src/app/core/vision/image-classifier.service.ts`
- `src/app/core/vision/image-classifier.service.spec.ts`
- `src/app/core/vision/vision.const.ts` (renamed from `src/app/core/vision/vision.prompt.ts`)
- `src/app/core/vision/vision.service.ts`
- `src/app/core/vision/vision.service.spec.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Prewarm Choice Directly in `ImageClassifierService` (`src/app/core/vision/image-classifier.service.ts`)

- [x] Replace the multi-line `decisionMaker.prewarm({ ... })` call in `initializeDecisionMaker()` with `await decisionMaker.prewarmChoice(IMAGE_CATEGORY_QUESTION);`:

  ```ts
  private async initializeDecisionMaker(modelAssetPath: string, delegate: 'GPU' | 'CPU'): Promise<DecisionMaker> {
    const { DecisionMaker, FilesetResolver } = await import('@mediapipe/tasks-decision');
    const wasmFileset = await FilesetResolver.forDecisionTasks(WASM_PATH);
    const decisionMaker = await DecisionMaker.createFromOptions(wasmFileset, {
      baseOptions: {
        modelAssetPath,
        delegate,
      },
      backendType: 3,
      maxNumTokens: MAX_NUM_TOKENS,
    });

    await decisionMaker.prewarmChoice(IMAGE_CATEGORY_QUESTION);

    return decisionMaker;
  }
  ```

### 2. Update `image-classifier.service.spec.ts` for `prewarmChoice`

- [x] Replace `mockPrewarm` with `mockPrewarmChoice` in `src/app/core/vision/image-classifier.service.spec.ts` and verify `mockPrewarmChoice` is called once with `IMAGE_CATEGORY_QUESTION`:

  ```ts
  expect(mockPrewarmChoice).toHaveBeenCalledTimes(1);
  expect(mockPrewarmChoice).toHaveBeenCalledWith(IMAGE_CATEGORY_QUESTION);
  ```

### 3. Replace `vision.prompt.ts` with `vision.const.ts` Exporting `CATEGORY_MODEL_CONFIGS`

- [x] Rename `src/app/core/vision/vision.prompt.ts` to `src/app/core/vision/vision.const.ts`, make the 5 prompt and system instruction strings module-private, and export `CATEGORY_MODEL_CONFIGS`:

  ```ts
  import type { CategoryModelConfig } from './image-analysis.interface';
  import { ImageAnalysisSchema } from './image-analysis.schema';
  import type { ImageSubjectCategory } from './image-category.type';

  const altTextPrompt = `...`;
  const peopleSystemInstruction = `...`;
  const peopleAltTextPrompt = `...`;
  const placeSystemInstruction = `...`;
  const placeAltTextPrompt = `...`;

  export const CATEGORY_MODEL_CONFIGS: Record<ImageSubjectCategory, CategoryModelConfig> = {
    general: {
      options: {
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      },
      prompt: altTextPrompt,
    },
    people: {
      options: {
        systemInstruction: peopleSystemInstruction,
        schema: ImageAnalysisSchema,
        tools: [{ googleSearch: {} }],
      },
      prompt: peopleAltTextPrompt,
    },
    place: {
      options: {
        systemInstruction: placeSystemInstruction,
        schema: ImageAnalysisSchema,
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
      },
      prompt: placeAltTextPrompt,
    },
  };
  ```

### 4. Simplify `VisionService` (`src/app/core/vision/vision.service.ts`)

- [x] Import `CATEGORY_MODEL_CONFIGS` from `./vision.const`, look up `const { options, prompt } = CATEGORY_MODEL_CONFIGS[category];` in `analyzeImage()`, and remove `private getCategoryModelConfig()` along with unused imports (`AiModelOptions`, `CategoryModelConfig`, `ImageAnalysisSchema`, `ImageSubjectCategory`, and `./vision.prompt`).

### 5. Update `vision.service.spec.ts` to Assert Against `CATEGORY_MODEL_CONFIGS`

- [x] Update `src/app/core/vision/vision.service.spec.ts` to import `CATEGORY_MODEL_CONFIGS` from `./vision.const` instead of the 5 individual prompt strings from `./vision.prompt`, asserting `mockAiModelFactory.getModel` and `mockAiModel.generateContent` against `CATEGORY_MODEL_CONFIGS.general`, `CATEGORY_MODEL_CONFIGS.people`, and `CATEGORY_MODEL_CONFIGS.place`.

### 6. Narrow Public Barrel Exports in `index.ts` (`src/app/core/vision/index.ts` & `src/testing/image-classifier.mock.ts`)

- [x] Replace `export *` in `src/app/core/vision/index.ts` with explicit `export type` exports for only the types consumed outside `src/app/core/vision/`:

  ```ts
  export type {
    VisionGroundingMetadata,
    ImageAnalysisResponse,
    TokenUsage,
    Recommendation,
  } from './image-analysis.interface';
  export type { ImageOptimizationMetrics } from './image-processing.interface';
  ```

- [x] Update `src/testing/image-classifier.mock.ts` to import `ImageSubjectCategory` directly from `@/core/vision/image-category.type`.

### 7. Verification

- [x] Run targeted unit tests and full repository lint/test validation:

  ```bash
  npm run test:spec src/app/core/vision/image-classifier.service.spec.ts
  npm run test:spec src/app/core/vision/vision.service.spec.ts
  npm run lint && npm run test:once
  ```
