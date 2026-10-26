import {
  AudioPlayerService,
  DEFAULT_AUDIO_TYPE,
  DEFAULT_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PERCENT,
  recordStreamChunks,
  TextToSpeechService,
  toWavBlob,
} from '@/core/speech';
import { revokeBlobURL } from '@/core/utils/blob.util';
import type { GeneratedAudioRecord } from '@/features/dashboard/components/speech-studio/interfaces/audio.interface';
import type { FactConfig } from '@/features/dashboard/interfaces/fact-config.interface';
import type { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

@Injectable()
export class SpeechStudioViewService {
  readonly #speechService = inject(TextToSpeechService);
  readonly #audioPlayerService = inject(AudioPlayerService);

  readonly #destroyRef$ = inject(DestroyRef);
  readonly #activeAudio = signal<GeneratedAudioRecord | undefined>(undefined);
  readonly #loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');
  readonly #playbackRate = signal(DEFAULT_PLAYBACK_RATE);

  activeAudio = this.#activeAudio.asReadonly();
  playbackRate = this.#playbackRate.asReadonly();
  loadingMode = this.#loadingMode.asReadonly();

  constructor() {
    this.#destroyRef$.onDestroy(() => this.clearAudio());
  }

  private setGeneratedAudioRecord(blob: Blob, prompt: string, voice: string): void {
    revokeBlobURL(this.#activeAudio()?.url);
    const url = URL.createObjectURL(blob);
    this.#activeAudio.set({ url, prompt, voice });
  }

  private clearAudio(): void {
    revokeBlobURL(this.#activeAudio()?.url);
    this.#activeAudio.set(undefined);
  }

  private async handlePlaybackError(e: unknown): Promise<void> {
    console.error('Streaming playback failed:', e);
    await this.#audioPlayerService.stopAll();
  }

  private async handleSync(promptArgs: FactConfig): Promise<void> {
    try {
      const blob = await this.#speechService.synthesize({ text: promptArgs.prompt, voice: promptArgs.voice });
      this.setGeneratedAudioRecord(blob, promptArgs.prompt, promptArgs.voice);
    } catch (e) {
      await this.handlePlaybackError(e);
      throw e;
    }
  }

  private calculateRandomPlaybackRate(min = MIN_PLAYBACK_RATE, max = MAX_PLAYBACK_RATE): number {
    const rawRate = Math.random() * (max - min) + min;
    return Math.round(rawRate * PERCENT) / PERCENT;
  }

  private async handleStream({ prompt, voice, shouldWait = false }: FactConfig): Promise<void> {
    const abortController = new AbortController();
    const unregisteredFn = this.#destroyRef$.onDestroy(() => abortController.abort());

    try {
      const rate = shouldWait ? 1 : this.calculateRandomPlaybackRate();
      this.#playbackRate.set(rate);

      const stream = this.#speechService.synthesizeStream({ text: prompt, voice });

      const rawChunks: Uint8Array[] = [];
      const activeStream = shouldWait ? recordStreamChunks(stream, rawChunks) : stream;

      await this.#audioPlayerService.playStream(activeStream, {
        playbackRate: rate,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (shouldWait && rawChunks.length > 0) {
        this.setGeneratedAudioRecord(toWavBlob(rawChunks, DEFAULT_AUDIO_TYPE), prompt, voice);
      } else {
        this.clearAudio();
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        await this.handlePlaybackError(e);
        throw e;
      }
    } finally {
      unregisteredFn();
    }
  }

  async generateSpeech(mode: GenerateSpeechMode, promptArgs: FactConfig): Promise<void> {
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
