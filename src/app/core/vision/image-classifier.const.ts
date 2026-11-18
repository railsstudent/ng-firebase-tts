import type { ChoiceQuestion } from '@mediapipe/tasks-decision';

export const WASM_PATH = '/wasm';
export const MAX_NUM_TOKENS = 512;

export const IMAGE_CATEGORY_QUESTION: ChoiceQuestion = {
  context: 'Analyze the uploaded image for accessibility alt-text routing.',
  instructions:
    'Select the primary subject category of this image. If an outdoor landscape, architecture, monument, landmark, or travel destination is visible behind people, select place. Otherwise, if any person, masked figure, or group of people is visible, select people.',
  options: [
    {
      label: 'place',
      description: 'An outdoor landscape, natural scenery, architecture, monument, landmark, or travel destination.',
    },
    {
      label: 'people',
      description: 'A person, portrait, face, masked or costumed figure, performer, or group of people.',
    },
    {
      label: 'general',
      description: 'A close-up of food, drink, animal, pet, vehicle, or household object.',
    },
  ],
  temperature: 0.05,
  normalizePrior: false,
};
