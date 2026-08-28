import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';

export interface AudioPrompt extends AudioPromptData {
  transcript: string;
}
