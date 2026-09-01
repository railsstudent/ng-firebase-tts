import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, model } from '@angular/core';
import { TextToSpeechViewService } from './services/text-to-speech-view';

@Component({
  selector: 'app-text-to-speech',
  templateUrl: './text-to-speech.component.html',
  styleUrl: './text-to-speech.component.css',
  imports: [SpinnerIconComponent, NgTemplateOutlet],
  providers: [TextToSpeechViewService],
})
export class TextToSpeechComponent {
  private readonly speechService = inject(TextToSpeechViewService);

  interestingFact = input<string | undefined>(undefined);
  audioPrompt = input.required<string>();
  voice = input.required<string>();

  ttsError = model<string>('');

  audioUrl = this.speechService.audioUrl;
  playbackRate = this.speechService.playbackRate;
  loadingMode = this.speechService.loadingRate;

  isLoading = computed(() => this.loadingMode() !== 'idle');

  async generateSpeech(mode: GenerateSpeechMode) {
    try {
      const fact = this.interestingFact();
      if (!fact) {
        return;
      }

      this.ttsError.set('');
      await this.speechService.generateSpeech(mode, {
        prompt: this.audioPrompt(),
        voice: this.voice(),
        fact,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error generating speech.';
      console.error('TTS Generation failed:', e);
      this.ttsError.set(errorMessage);
    }
  }
}
