import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, model, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-text-to-speech',
  templateUrl: './text-to-speech.component.html',
  styleUrl: './text-to-speech.component.css',
  imports: [SpinnerIconComponent, NgTemplateOutlet],
})
export class TextToSpeechComponent implements OnDestroy {
  private readonly speechService = inject(TextToSpeechService);
  private readonly audioPlayerService = inject(AudioPlayerService);

  interestingFact = input<string | undefined>(undefined);
  audioPrompt = input.required<string>();
  voice = input.required<string>();

  playbackRate = this.audioPlayerService.playbackRate;

  audioUrl = signal<string | undefined>(undefined);
  ttsError = model<string>('');
  loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');

  isLoading = computed(() => this.loadingMode() !== 'idle');

  async generateSpeech(mode: GenerateSpeechMode) {
    const fact = this.interestingFact();
    if (!fact) {
      return;
    }

    // 1. Clean up previous URL immediately before starting
    revokeBlobURL(this.audioUrl());
    this.audioUrl.set(undefined);
    this.ttsError.set('');

    try {
      this.loadingMode.set(mode);
      if (mode === 'sync' || mode === 'stream') {
        await this.handleSyncOrStream(mode, this.audioPrompt(), this.voice());
      } else if (mode === 'web_audio_api') {
        await this.handleWebAudio(this.audioPrompt(), this.voice());
      }
    } catch (e) {
      console.error('TTS Generation failed:', e);
      this.ttsError.set(
        mode === 'web_audio_api'
          ? 'Error streaming speech using the Web Audio API.'
          : `Error generating speech (${mode === 'stream' ? 'Stream' : 'Sync'}).`,
      );
      revokeBlobURL(this.audioUrl());
      this.audioUrl.set(undefined);
    } finally {
      this.loadingMode.set('idle');
    }
  }

  private async handleSyncOrStream(
    mode: Omit<GenerateSpeechMode, 'web_audio_api'>,
    prompt: string,
    voice: string,
  ) {
    let createdUrl: string | undefined = undefined;
    try {
      const blob =
        mode === 'stream'
          ? await this.speechService.synthesizeStream(prompt, voice)
          : await this.speechService.synthesize(prompt, voice);
      createdUrl = URL.createObjectURL(blob);
      this.audioUrl.set(createdUrl);
    } catch (e) {
      if (createdUrl) {
        revokeBlobURL(createdUrl);
      }
      throw e;
    }
  }

  private async handleWebAudio(prompt: string, voice: string) {
    await this.speechService.speak(prompt, voice);
  }

  ngOnDestroy(): void {
    revokeBlobURL(this.audioUrl());
  }
}
