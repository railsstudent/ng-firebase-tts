import {
  DEFAULT_AUDIO_TYPE,
  DEFAULT_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
} from '@/core/constants/text-to-speech.constant';
import { recordStreamChunks, toWavBlob } from '@/core/utils/audio.util';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { GeneratedAudioRecord } from '@/features/dashboard/components/text-to-speech/interfaces/audio.interface';
import { FactConfig } from '@/features/dashboard/interfaces/fact-config.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { computed, DestroyRef, inject, Injectable, injectAsync, signal } from '@angular/core';

@Injectable()
export class TextToSpeechViewService {
  readonly #asyncSpeechService = injectAsync(() =>
    import('@/core/services/text-to-speech.service').then((m) => m.TextToSpeechService),
  );

  readonly #asyncAudioPlayerService = injectAsync(() =>
    import('@/core/services/audio-player.service').then((m) => m.AudioPlayerService),
  );

  readonly #destroyRef$ = inject(DestroyRef);
  readonly #activeAudio = signal<GeneratedAudioRecord | undefined>(undefined);
  readonly #loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');
  readonly #playbackRate = signal(DEFAULT_PLAYBACK_RATE);

  audioUrl = computed(() => this.#activeAudio()?.url);
  activeAudio = this.#activeAudio.asReadonly();
  playbackRate = this.#playbackRate.asReadonly();
  loadingMode = this.#loadingMode.asReadonly();

  constructor() {
    this.#destroyRef$.onDestroy(() => this.clearAudio());
  }

  private setGeneratedAudioRecord(blob: Blob, prompt: string, voice: string) {
    // Clean up any existing Blob URL to prevent memory leaks
    revokeBlobURL(this.#activeAudio()?.url);

    const url = URL.createObjectURL(blob);
    this.#activeAudio.set({ url, prompt, voice });
  }

  private clearAudio() {
    revokeBlobURL(this.#activeAudio()?.url);
    this.#activeAudio.set(undefined);
  }

  private async handlePlaybackError(e: unknown) {
    console.error('Streaming playback failed:', e);
    const audioPlayerService = await this.#asyncAudioPlayerService();
    audioPlayerService.stopAll();
  }

  private async handleSync(promptArgs: FactConfig) {
    try {
      const speechService = await this.#asyncSpeechService();
      const blob = await speechService.synthesize({ text: promptArgs.prompt, voice: promptArgs.voice });
      this.setGeneratedAudioRecord(blob, promptArgs.prompt, promptArgs.voice);
    } catch (e) {
      this.handlePlaybackError(e);
      throw e;
    }
  }

  private calculateRandomPlaybackRate(min = MIN_PLAYBACK_RATE, max = MAX_PLAYBACK_RATE) {
    const percent = 100;
    const rawRate = Math.random() * (max - min) + min;
    return Math.round(rawRate * percent) / percent;
  }

  private async handleStream({ prompt, voice, shouldWait = false }: FactConfig) {
    const abortController = new AbortController();
    const unregisteredFn = this.#destroyRef$.onDestroy(() => abortController.abort());

    try {
      const rate = shouldWait ? 1 : this.calculateRandomPlaybackRate();
      this.#playbackRate.set(rate);

      const speechService = await this.#asyncSpeechService();
      const stream = speechService.synthesizeStream({ text: prompt, voice });

      const rawChunks: Uint8Array[] = [];
      const activeStream = shouldWait ? recordStreamChunks(stream, rawChunks) : stream;

      const audioPlayerService = await this.#asyncAudioPlayerService();
      await audioPlayerService.playStream(activeStream, {
        playbackRate: rate,
        signal: abortController.signal,
      });

      if (shouldWait && !abortController.signal.aborted && rawChunks.length > 0) {
        this.setGeneratedAudioRecord(toWavBlob(rawChunks, DEFAULT_AUDIO_TYPE), prompt, voice);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        this.handlePlaybackError(e);
        throw e;
      }
    } finally {
      unregisteredFn();
    }
  }

  async generateSpeech(mode: GenerateSpeechMode, promptArgs: FactConfig) {
    if (!promptArgs.fact || this.#loadingMode() !== 'idle') {
      return;
    }

    try {
      this.#loadingMode.set(mode);
      switch (mode) {
        case 'sync':
          await this.handleSync(promptArgs);
          break;
        case 'stream':
        case 'web_audio_api':
          await this.handleStream({ ...promptArgs, shouldWait: mode === 'stream' });
          break;
        default:
          throw new Error(`Unsupported mode: ${mode}`);
      }
    } catch (e) {
      console.error('TTS Generation failed:', e);
      throw new Error(
        mode === 'web_audio_api'
          ? 'Error streaming speech using the Web Audio API.'
          : `Error generating speech (${mode === 'stream' ? 'Stream' : 'Sync'}).`,
        { cause: e },
      );
    } finally {
      this.#loadingMode.set('idle');
    }
  }
}
