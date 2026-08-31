import { AudioTagsComponent } from '@/features/dashboard/components/audio-tags/audio-tags.component';
import { TextToSpeechComponent } from '@/features/dashboard/components/text-to-speech/text-to-speech.component';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { Component, computed, input, signal, viewChild } from '@angular/core';
import { buildAudioPrompt } from './utils/audio-prompt.util';

@Component({
  selector: 'app-obscure-fact',
  templateUrl: './obscure-fact.component.html',
  styleUrl: './obscure-fact.component.css',
  imports: [TextToSpeechComponent, ErrorDisplayComponent, AudioTagsComponent],
})
export class ObscureFactComponent {
  interestingFact = input<string | undefined>(undefined);

  audioTags = viewChild.required(AudioTagsComponent);

  ttsError = signal<string>('');

  audioTagsModel = computed(() => this.audioTags().audioPromptModel());
  audioPrompt = computed(() =>
    buildAudioPrompt({
      ...this.audioTagsModel(),
      transcript: this.interestingFact() || '',
    }),
  );

  voice = computed(() => this.audioTagsModel().voiceOption);
}
