import type { ChoiceQuestion } from '@mediapipe/tasks-decision';

export const WASM_PATH = '/wasm';
export const MAX_NUM_TOKENS = 512;

export const IMAGE_CATEGORY_QUESTION: ChoiceQuestion = {
  context: 'Analyze the uploaded image for accessibility alt-text routing.',
  instructions:
    'Classify the primary subject category of this image. If a landmark, pyramid, monument, or scenic travel location is visible behind a person, select place.',
  options: [
    {
      label: 'place',
      description:
        'A landmark, pyramid, monument, archaeological ruin, temple, building, architecture, streetscape, cityscape, outdoor landscape, or travel photo of a person at a landmark.',
    },
    {
      label: 'people',
      description:
        'A portrait, close-up face, masked person, athlete, wrestler, performer, or group of people in a studio, ring, indoor room, or plain background without a landmark.',
    },
    {
      label: 'general',
      description: 'An inanimate object, animal, pet, food, drink, document, text, screenshot, vehicle, or plant.',
    },
  ],
  temperature: 0.05,
  normalizePrior: false,
};
