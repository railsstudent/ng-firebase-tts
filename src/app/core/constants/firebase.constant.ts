import { InjectionToken } from '@angular/core';
import { AI, GenerativeModel, HarmBlockThreshold, HarmCategory } from 'firebase/ai';

export const VISION_AI_MODEL = new InjectionToken<GenerativeModel>('VISION_AI_MODEL');

export const AI_BACKEND = new InjectionToken<AI>('AI_BACKEND');

export const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];
