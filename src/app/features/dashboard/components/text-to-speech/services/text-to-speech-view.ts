import { DEFAULT_PLAYBACK_RATE, MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from '@/core/constants/text-to-speech.constant';
import { AudioStreamChunk } from '@/core/interfaces/text-to-speech.interface';
import { toWavBlob } from '@/core/utils/audio.util';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { FactConfig } from '@/features/dashboard/interfaces/fact-config.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { DestroyRef, inject, Injectable, injectAsync, signal } from '@angular/core';

@Injectable()
export class TextToSpeechViewService {
  readonly #asyncSpeechService = injectAsync(() =>
    import('@/core/services/text-to-speech.service').then((m) => m.TextToSpeechService),
  );

  readonly #asyncAudioPlayerService = injectAsync(() =>
    import('@/core/services/audio-player.service').then((m) => m.AudioPlayerService),
  );

  readonly #destroyRef$ = inject(DestroyRef);
  readonly #audioUrl = signal<string | undefined>(undefined);
  readonly #loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');
  readonly #playbackRate = signal(DEFAULT_PLAYBACK_RATE);

  audioUrl = this.#audioUrl.asReadonly();
  playbackRate = this.#playbackRate.asReadonly();
  loadingMode = this.#loadingMode.asReadonly();

  constructor() {
    this.#destroyRef$.onDestroy(async () => revokeBlobURL(this.#audioUrl()));
  }

  private async handlePlaybackError(e: unknown) {
    console.error('Streaming playback failed:', e);
    const audioPlayerService = await this.#asyncAudioPlayerService();
    audioPlayerService.stopAll();
    revokeBlobURL(this.#audioUrl());
  }

  private async handleSync(promptArgs: FactConfig) {
    try {
      const speechService = await this.#asyncSpeechService();
      const blob = await speechService.synthesize({ text: promptArgs.prompt, voice: promptArgs.voice });
      this.setAudioUrl(blob);
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

  private async consumeStream(
    stream: AsyncGenerator<AudioStreamChunk>,
    collectBlob: boolean,
    abortSignal: AbortSignal,
  ): Promise<Blob | undefined> {
    const audioPlayer = await this.#asyncAudioPlayerService();
    const pcmChunks: Uint8Array[] = [];
    let mimeType = '';
    let isInitialized = false;

    for await (const chunk of stream) {
      if (abortSignal.aborted) {
        return undefined;
      }

      if (!isInitialized) {
        audioPlayer.initialize(chunk.sampleRate, this.#playbackRate());
        isInitialized = true;
      }
      audioPlayer.processChunk(chunk.decodedData);

      if (collectBlob) {
        pcmChunks.push(chunk.decodedData);
        if (!mimeType) {
          mimeType = chunk.mimeType;
        }
      }
    }

    return collectBlob && pcmChunks.length > 0 ? toWavBlob(pcmChunks, mimeType) : undefined;
  }

  private async handleStream({ prompt, voice, shouldWait = false }: FactConfig) {
    const abortController = new AbortController();
    const unregisteredFn = this.#destroyRef$.onDestroy(() => abortController.abort());

    try {
      this.#playbackRate.set(shouldWait ? 1 : this.calculateRandomPlaybackRate());

      const speechService = await this.#asyncSpeechService();
      const stream = speechService.synthesizeStream({ text: prompt, voice });
      const finalBlob = await this.consumeStream(stream, shouldWait, abortController.signal);

      if (shouldWait && !abortController.signal.aborted) {
        const audioPlayerService = await this.#asyncAudioPlayerService();
        await audioPlayerService.awaitPlaybackComplete();
        this.setAudioUrl(finalBlob);
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
