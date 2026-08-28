import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { AudioPromptData } from './audio-prompt-data.interface';

export interface ModeWithAudioTags {
  mode: GenerateSpeechMode;
  audioTags: AudioPromptData;
}
