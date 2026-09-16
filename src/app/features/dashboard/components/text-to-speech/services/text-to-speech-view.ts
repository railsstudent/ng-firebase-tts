import { DEFAULT_PLAYBACK_RATE, MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary } from '@/core/interfaces/text-to-speech.interface';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { FactConfig } from '@/features/dashboard/interfaces/fact-config.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { DestroyRef, inject, Injectable, injectAsync, signal } from '@angular/core';

@Injectable()
export class TextToSpeechViewService {
  #asyncSpeechService = injectAsync(() =>
    import('@/core/services/text-to-speech.service').then((m) => m.TextToSpeechService),
  );

  #asyncAudioPlayerService = injectAsync(() =>
    import('@/core/services/audio-player.service').then((m) => m.AudioPlayerService),
  );

  #destroyRef$ = inject(DestroyRef);
  #audioUrl = signal<string | undefined>(undefined);
  #loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');
  #playbackRate = signal(DEFAULT_PLAYBACK_RATE);

  audioUrl = this.#audioUrl.asReadonly();
  playbackRate = this.#playbackRate.asReadonly();
  loadingMode = this.#loadingMode.asReadonly();

  constructor() {
    this.#destroyRef$.onDestroy(async () => revokeBlobURL(this.#audioUrl()));
  }

  private async handlePlaybackError(e: unknown, createdUrl: string | undefined) {
    console.error('Streaming playback failed:', e);
    const audioPlayerService = await this.#asyncAudioPlayerService();
    audioPlayerService.stopAll();
    revokeBlobURL(createdUrl);
  }

  private async processStreamChunk(
    isInitialized: boolean,
    playbackRate: number,
    chunk: RawAudioBinary,
  ): Promise<boolean> {
    const audioPlayerService = await this.#asyncAudioPlayerService();
    if (!isInitialized) {
      audioPlayerService.initialize(chunk.sampleRate, playbackRate);
      isInitialized = true;
    }
    audioPlayerService.processChunk(chunk.decodedData);
    return isInitialized;
  }

  private async handleSync(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;
    try {
      const speechService = await this.#asyncSpeechService();
      const blob = await speechService.synthesize({ text: promptArgs.prompt, voice: promptArgs.voice });
      createdUrl = this.setAudioUrl(blob);
    } catch (e) {
      this.handlePlaybackError(e, createdUrl);
      throw e;
    }
  }

  private calculateRandomPlaybackRate(min = MIN_PLAYBACK_RATE, max = MAX_PLAYBACK_RATE) {
    const percent = 100;
    const rawRate = Math.random() * (max - min) + min;
    return Math.round(rawRate * percent) / percent;
  }

  private async consumeStream(stream: AsyncGenerator<RawAudioBinary | Blob | undefined>, abortSignal: AbortSignal) {
    let finalBlob: Blob | undefined = undefined;
    let isInitialized = false;

    for await (const chunk of stream) {
      if (abortSignal.aborted) {
        break;
      }

      if (chunk instanceof Blob) {
        finalBlob = chunk;
      } else if (chunk) {
        isInitialized = await this.processStreamChunk(isInitialized, this.#playbackRate(), chunk);
      }
    }

    return finalBlob;
  }

  private async handleStream(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;

    const abortController = new AbortController();
    const { signal: abortSignal } = abortController;
    const unregisteredFn = this.#destroyRef$.onDestroy(() => abortController.abort());

    try {
      const { prompt, voice, shouldWait = false } = promptArgs;
      const streamPlaybackRate = shouldWait ? 1 : this.calculateRandomPlaybackRate();
      this.#playbackRate.set(streamPlaybackRate);

      const speechService = await this.#asyncSpeechService();
      const stream = speechService.synthesizeStream({ text: prompt, voice: voice, shouldWait });
      const finalBlob = await this.consumeStream(stream, abortSignal);

      if (shouldWait && !abortSignal.aborted) {
        const audioPlayerService = await this.#asyncAudioPlayerService();
        await audioPlayerService.awaitPlaybackComplete();
        createdUrl = this.setAudioUrl(finalBlob);
      }
    } catch (e) {
      if (!abortSignal.aborted) {
        this.handlePlaybackError(e, createdUrl);
        throw e;
      }
    } finally {
      unregisteredFn();
    }
  }

  private setAudioUrl(finalBlob: Blob | undefined) {
    if (finalBlob) {
      const createdUrl = URL.createObjectURL(finalBlob);
      this.#audioUrl.set(createdUrl);
      return createdUrl;
    }
    return undefined;
  }

  async generateSpeech(mode: GenerateSpeechMode, promptArgs: FactConfig) {
    if (!promptArgs.fact || this.#loadingMode() !== 'idle') {
      return;
    }

    // 1. Clean up previous URL immediately before starting
    revokeBlobURL(this.#audioUrl());
    this.#audioUrl.set(undefined);

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
      revokeBlobURL(this.#audioUrl());
      this.#audioUrl.set(undefined);

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
