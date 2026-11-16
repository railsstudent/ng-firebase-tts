import type { ChoiceQuestion } from '@mediapipe/tasks-decision';

export const WASM_PATH = '/wasm';
export const MAX_NUM_TOKENS = 512;

export const IMAGE_CATEGORY_QUESTION: ChoiceQuestion = {
  context: 'Analyze the uploaded image for accessibility alt-text routing.',
  instructions: 'Classify the primary subject category of this image.',
  options: [
    {
      label: 'place',
      description:
        'A recognizable landmark, monument, building, streetscape, or geographic location, even if people or faces appear in the foreground.',
    },
    {
      label: 'people',
      description:
        'A portrait, close-up face, solo person, or group of people where human subjects are the primary focus without a recognizable landmark.',
    },
    {
      label: 'general',
      description:
        'Objects, animals, food, documents, nature close-ups, abstract scenes, or any image that is neither a recognizable place nor focused on people.',
    },
  ],
  normalizePrior: true,
};
