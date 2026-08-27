import { InjectionToken } from '@angular/core';
import { GenerativeModel } from 'firebase/ai';

export const AI_MODEL = new InjectionToken<GenerativeModel>('AI_MODEL');
