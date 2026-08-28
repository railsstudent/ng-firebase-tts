import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { AudioTagsComponent } from '@/features/dashboard/components/audio-tags/audio-tags.component';
import { TextToSpeechComponent } from '@/features/dashboard/components/text-to-speech/text-to-speech.component';
import { ModeWithAudioTags } from '@/features/dashboard/interfaces/mode-audio-tags.interface';
import { ErrorDisplayComponent } from '@/shared/ui/error-display/error-display.component';
import { Component, inject, input, OnDestroy, signal } from '@angular/core';
import { buildAudioPrompt } from './utils/audio-prompt.util';

@Component({
  selector: 'app-obscure-fact',
  templateUrl: './obscure-fact.component.html',
  styleUrl: './obscure-fact.component.css',
  imports: [TextToSpeechComponent, ErrorDisplayComponent, AudioTagsComponent],
})
export class ObscureFactComponent implements OnDestroy {
  interestingFact = input<string | undefined>(undefined);

  private readonly speechService = inject(TextToSpeechService);
  private readonly audioPlayerService = inject(AudioPlayerService);

  isLoadingSync = signal(false);
  isLoadingStream = signal(false);
  isLoadingWebAudio = signal(false);

  audioUrl = signal<string | undefined>(undefined);
  playbackRate = this.audioPlayerService.playbackRate;
  ttsError = signal<string>('');

  async generateSpeech({ mode, audioTags }: ModeWithAudioTags) {
    const fact = this.interestingFact();
    if (!fact) {
      return;
    }

    // 1. Clean up previous URL immediately before starting
    revokeBlobURL(this.audioUrl());
    this.audioUrl.set(undefined);
    this.ttsError.set('');

    const customPrompt = buildAudioPrompt({
      ...audioTags,
      transcript: fact,
    });
    const voice = audioTags.voiceOption;

    try {
      if (mode === 'sync' || mode === 'stream') {
        await this.handleSyncOrStream(mode, customPrompt, voice);
      } else if (mode === 'web_audio_api') {
        await this.handleWebAudio(customPrompt, voice);
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
    }
  }

  private async handleSyncOrStream(mode: 'sync' | 'stream', prompt: string, voice: string) {
    const loadingSignal = mode === 'stream' ? this.isLoadingStream : this.isLoadingSync;
    loadingSignal.set(true);
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
    } finally {
      loadingSignal.set(false);
    }
  }

  private async handleWebAudio(prompt: string, voice: string) {
    this.isLoadingWebAudio.set(true);
    try {
      await this.speechService.speak(prompt, voice);
    } finally {
      this.isLoadingWebAudio.set(false);
    }
  }

  ngOnDestroy(): void {
    revokeBlobURL(this.audioUrl());
  }
}
