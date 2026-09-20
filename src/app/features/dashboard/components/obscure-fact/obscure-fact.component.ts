import { AudioTagsComponent } from '@/features/dashboard/components/audio-tags/audio-tags.component';
import { TextToSpeechComponent } from '@/features/dashboard/components/text-to-speech/text-to-speech.component';
import { DEFAULT_VOICE } from '@/features/dashboard/constants/voice-name.const';
import { AudioPromptData } from '@/features/dashboard/interfaces/audio-prompt-data.interface';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { Component, computed, input, signal } from '@angular/core';
import { buildAudioPrompt } from './utils/audio-prompt.util';

@Component({
  selector: 'app-obscure-fact',
  templateUrl: './obscure-fact.component.html',
  styleUrl: './obscure-fact.component.css',
  imports: [TextToSpeechComponent, ErrorDisplayComponent, AudioTagsComponent],
})
export class ObscureFactComponent {
  interestingFact = input<string | undefined>(undefined);

  audioPromptModel = signal<AudioPromptData>({
    scene: 'A news anchor reading the news in a busy newsroom',
    emotion: 'professional, slightly serious',
    pace: 'moderate, clear enunciation',
    voiceOption: DEFAULT_VOICE,
  });

  ttsError = signal<string>('');

  audioPrompt = computed(() =>
    buildAudioPrompt({
      ...this.audioPromptModel(),
      transcript: this.interestingFact() || '',
    }),
  );
}
