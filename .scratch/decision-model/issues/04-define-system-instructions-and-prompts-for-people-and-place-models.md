# 04: Define System Instructions and Prompts for People (`people`) and Place (`place`) Models

**What to build:**
Update `src/app/core/vision/vision.prompt.ts` to define and export the specialized `systemInstruction` and prompt constants for the **`people`** (portrait / face) and **`place`** (landmark / location) generative models alongside the existing `altTextPrompt` for the **`general`** model, accompanied by unit tests in `src/app/core/vision/vision.prompt.spec.ts`.

**Blocked by:** None (can start immediately)

**Status:** done

## Target Files

- `src/app/core/vision/vision.prompt.ts`
- `src/app/core/vision/vision.prompt.spec.ts` (New)

## Acceptance Criteria & Implementation Checklist

### 1. Define `people` and `place` System Instructions and Prompts (`src/app/core/vision/vision.prompt.ts`)

- [x] Update `src/app/core/vision/vision.prompt.ts` to export `peopleSystemInstruction`, `peopleAltTextPrompt`, `placeSystemInstruction`, `placeAltTextPrompt`, and the existing `altTextPrompt`:

  ```ts
  export const altTextPrompt = `
    You are asked to perform four tasks:
    Task 1: Generate 1 - 3 sentences of alternative texts for the image provided, max 300 words.
    Task 2: Generate at least 3 tags to describe the image.
    Task 3: Based on the alternative text and tags, provide some suggestions to make the image more interesting and the reason to support them.
    Task 4: Search for a surprising or obscure fact that interconnects the following tags. If a direct link doesn't exist, find a conceptual link between them.
  `;

  export const peopleSystemInstruction = `
    You are an expert portrait and human-subject accessibility analyst.
    When analyzing images containing people or faces, identify recognizable public figures, celebrities, or historical figures by name and notable context using Google Search when possible.
    When a person cannot be confidently identified as a public figure, never guess or fabricate a name; instead, focus closely on observable human and compositional features.
  `;

  export const peopleAltTextPrompt = `
    You are asked to perform four tasks for this image featuring a person, face, or group of people:
    Task 1: Generate 1 - 3 sentences of alternative text for the image provided, max 300 words. If the person is a recognizable public figure or celebrity, identify them by name and context. If the person cannot be identified, do not guess a name; instead, describe their facial expression, emotion, gaze direction, posture or action, attire and accessories, framing (close-up, medium shot, group portrait), and lighting or setting.
    Task 2: Generate at least 3 tags to describe the image (including the person's name if recognizable, or key portrait and mood descriptors).
    Task 3: Based on the alternative text and tags, provide some suggestions to make the portrait or human-subject composition more interesting and the reason to support them.
    Task 4: Search for a surprising or obscure fact that interconnects the generated tags. If a direct link doesn't exist, find a conceptual link between them.
  `;

  export const placeSystemInstruction = `
    You are an expert geographical, landmark, and architectural vision analyst.
    Use Google Maps and Google Search grounding to accurately identify landmarks, buildings, streetscapes, and natural locations, including their official place name and geographic coordinates (latitude and longitude).
    Never fabricate coordinates if a location cannot be verified.
  `;

  export const placeAltTextPrompt = `
    You are asked to perform four tasks for this image of a place or landmark:
    Task 1: Generate 1 - 3 sentences of alternative text for the image provided, max 300 words. Explicitly include the official Place Name and its Latitude and Longitude coordinates (for example, "Place Name (48.8584° N, 2.2945° E)") woven naturally into the description alongside key architectural and geographic features. If the exact place cannot be verified with certainty, describe the architectural style and likely geographic setting without fabricating coordinates.
    Task 2: Generate at least 3 tags to describe the image (including the place name, city or region, and architectural or natural category).
    Task 3: Based on the alternative text and tags, provide some suggestions to make the landmark or location photo more interesting and the reason to support them.
    Task 4: Search for a surprising or obscure historical or geographical fact that interconnects the generated tags. If a direct link doesn't exist, find a conceptual link between them.
  `;
  ```

### 2. Add Unit Tests for Prompt Contracts (`src/app/core/vision/vision.prompt.spec.ts`)

- [x] Create `src/app/core/vision/vision.prompt.spec.ts` implementing the Red -> Green test suite for the `people`, `place`, and `general` prompt contracts:

  ```ts
  import {
    altTextPrompt,
    peopleAltTextPrompt,
    peopleSystemInstruction,
    placeAltTextPrompt,
    placeSystemInstruction,
  } from './vision.prompt';

  describe('vision.prompt', () => {
    it('should define peopleSystemInstruction and peopleAltTextPrompt with celebrity recognition and visual feature fallback', () => {
      expect(peopleSystemInstruction).toContain('public figures');
      expect(peopleSystemInstruction).toContain('never guess or fabricate a name');

      expect(peopleAltTextPrompt).toContain('Task 1:');
      expect(peopleAltTextPrompt).toContain('Task 2:');
      expect(peopleAltTextPrompt).toContain('Task 3:');
      expect(peopleAltTextPrompt).toContain('Task 4:');
      expect(peopleAltTextPrompt).toContain('facial expression');
      expect(peopleAltTextPrompt).toContain('do not guess a name');
    });

    it('should define placeSystemInstruction and placeAltTextPrompt with Place Name and Latitude and Longitude requirements', () => {
      expect(placeSystemInstruction).toContain('Google Maps and Google Search');
      expect(placeSystemInstruction).toContain('latitude and longitude');
      expect(placeSystemInstruction).toContain('Never fabricate coordinates');

      expect(placeAltTextPrompt).toContain('Task 1:');
      expect(placeAltTextPrompt).toContain('Task 2:');
      expect(placeAltTextPrompt).toContain('Task 3:');
      expect(placeAltTextPrompt).toContain('Task 4:');
      expect(placeAltTextPrompt).toContain('Place Name');
      expect(placeAltTextPrompt).toContain('Latitude and Longitude');
    });

    it('should preserve altTextPrompt for the general model with all four tasks', () => {
      expect(altTextPrompt).toContain('Task 1:');
      expect(altTextPrompt).toContain('Task 2:');
      expect(altTextPrompt).toContain('Task 3:');
      expect(altTextPrompt).toContain('Task 4:');
    });
  });
  ```

### 3. Verification

- [x] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/core/vision/vision.prompt.spec.ts
  ```
