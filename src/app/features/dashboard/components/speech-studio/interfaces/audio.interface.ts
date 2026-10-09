import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';

export interface GeneratedAudioRecord {
  url: string;
  prompt: string;
  voice: string;
}

export interface SpeechModeConfig {
  mode: GenerateSpeechMode;
  ariaLabel: string;
  buttonText: string;
  getGenText?: () => string;
}
