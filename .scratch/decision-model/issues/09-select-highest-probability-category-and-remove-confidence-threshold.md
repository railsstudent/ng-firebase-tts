# 09: Select Highest Probability Category in `ImageClassifierService` and Remove `decisionConfidenceThreshold`

**What to build:**
Update `ImageClassifierService.classifyImage()` in `src/app/core/vision/image-classifier.service.ts` to select the `ImageSubjectCategory` with the highest probability from `result.probabilities` instead of gating on `result.confidence < decisionConfidenceThreshold` and `if/else` branching on `result.selectedKey`, and remove the unused `decisionConfidenceThreshold` configuration property across `ConfigService`, `AppRemoteConfig`, and test mocks.

**Blocked by:** None (can start immediately)

**Status:** done

## Target Files

- `src/app/core/vision/image-classifier.service.ts`
- `src/app/core/vision/image-classifier.service.spec.ts`
- `src/app/core/firebase/app-remote-config.interface.ts`
- `src/app/core/firebase/config.service.ts`
- `src/app/core/firebase/config.service.spec.ts`
- `src/testing/config.mock.ts`
- `src/testing/firebase.mock.ts`
- `public/remote-config-defaults.json`
- `firebase/remote-config-template.json`

## Acceptance Criteria & Implementation Checklist

### 1. Loop `result.probabilities` in `ImageClassifierService.classifyImage()` (`src/app/core/vision/image-classifier.service.ts`)

- [x] Remove `decisionConfidenceThreshold` and the `result.confidence` / `result.selectedKey` `if` checks in `classifyImage()`, and iterate `Object.entries(probabilities)` to return the `ImageSubjectCategory` with the highest probability (defaulting to `'general'`):

  ```ts
  async classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
    if (imageBytes.byteLength === 0) {
      return 'general';
    }

    const { decisionModelPath } = this.#configService.appConfig;
    const delegate = this.resolveDelegate(decisionModelPath);
    if (!delegate) {
      return 'general';
    }

    try {
      const decisionMaker = await this.getDecisionMaker(delegate);
      const { probabilities } = await decisionMaker.evaluateChoice({ imageBytes }, IMAGE_CATEGORY_QUESTION);

      let bestCategory: ImageSubjectCategory = 'general';
      let highestProbability = -1;

      for (const [key, probability] of Object.entries(probabilities)) {
        if (probability > highestProbability) {
          highestProbability = probability;
          bestCategory = key as ImageSubjectCategory;
        }
      }

      return bestCategory;
    } catch (error) {
      console.warn('[ImageClassifierService] On-device classification failed, falling back to general:', error);
      return 'general';
    }
  }
  ```

### 2. Update Unit Tests in `src/app/core/vision/image-classifier.service.spec.ts`

- [ ] Replace the confidence-threshold fallback test with probability-ranking assertions verifying that `classifyImage()` selects the key in `probabilities` with the highest probability (even when `confidence` is low, such as `0.16` for `{ general: 0.13, people: 0.26, place: 0.61 }`) and defaults to `'general'` when `'general'` has the highest probability or `probabilities` is empty:

  ```ts
  it('should return "people" when "people" has the highest probability', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'people',
      confidence: 0.85,
      probabilities: { people: 0.85, place: 0.1, general: 0.05 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('people');
  });

  it('should return "place" when "place" has the highest probability even if confidence is low', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'place',
      confidence: 0.16,
      probabilities: { general: 0.13, people: 0.26, place: 0.61 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('place');
  });

  it('should return "general" when "general" has the highest probability or probabilities are empty', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'general',
      confidence: 0.6,
      probabilities: { general: 0.6, people: 0.2, place: 0.2 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('general');

    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'general',
      confidence: 0,
      probabilities: {},
    });

    const emptyCategory = await service.classifyImage(sampleBytes);
    expect(emptyCategory).toBe('general');
  });
  ```

### 3. Remove `decisionConfidenceThreshold` from `ConfigService`, `AppRemoteConfig`, Remote Config JSONs, and Test Mocks

- [x] Remove `decisionConfidenceThreshold: number;` from `AppRemoteConfig` in `src/app/core/firebase/app-remote-config.interface.ts`.
- [x] Remove `decisionConfidenceThreshold` initialization and Remote Config lookup from `src/app/core/firebase/config.service.ts`.
- [x] Remove `decisionConfidenceThreshold` from `DEFAULT_REMOTE_CONFIG` and test expectations in `src/app/core/firebase/config.service.spec.ts`.
- [x] Remove `decisionConfidenceThreshold` from `createMockAppRemoteConfig` in `src/testing/config.mock.ts` and `createRemoteConfigMocks` in `src/testing/firebase.mock.ts`.
- [x] Remove `decisionConfidenceThreshold` from `public/remote-config-defaults.json` and `firebase/remote-config-template.json`.

### 4. Verification

- [ ] Run targeted unit tests and full repository validation:

  ```bash
  npm run test:spec src/app/core/vision/image-classifier.service.spec.ts
  npm run test:spec src/app/core/firebase/config.service.spec.ts
  npm run lint && npm run test:once
  ```
