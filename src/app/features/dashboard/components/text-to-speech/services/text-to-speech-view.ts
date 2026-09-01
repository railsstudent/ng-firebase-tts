import { MAX_PLAYBACK_RATE, MIN_PLAYBACK_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary } from '@/core/interfaces/text-to-speech.type';
import { AudioPlayerService } from '@/core/services/audio-player.service';
import { TextToSpeechService } from '@/core/services/text-to-speech.service';
import { revokeBlobURL } from '@/core/utils/blob.util';
import { FactConfig } from '@/features/dashboard/interfaces/fact-config.interface';
import { GenerateSpeechMode } from '@/features/dashboard/types/generate-speech-mode.type';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

@Injectable()
export class TextToSpeechViewService {
  private readonly speechService = inject(TextToSpeechService);
  private readonly audioPlayerService = inject(AudioPlayerService);

  destroyRef$ = inject(DestroyRef);
  #audioUrl = signal<string | undefined>(undefined);
  #loadingMode = signal<GenerateSpeechMode | 'idle'>('idle');

  audioUrl = this.#audioUrl.asReadonly();
  playbackRate = this.audioPlayerService.playbackRate;
  loadingRate = this.#loadingMode.asReadonly();

  constructor() {
    this.destroyRef$.onDestroy(() => {
      console.log('TextToSpeechView destroyed');
      revokeBlobURL(this.#audioUrl());
    });
  }

  private handlePlaybackError(e: unknown, createdUrl: string | undefined) {
    console.error('Streaming playback failed:', e);
    this.audioPlayerService.stopAll();
    revokeBlobURL(createdUrl);
  }

  private processStreamChunk(isInitialized: boolean, playbackRate: number, chunk: RawAudioBinary) {
    if (!isInitialized) {
      this.audioPlayerService.initialize(chunk.sampleRate, playbackRate);
      isInitialized = true;
    }
    this.audioPlayerService.processChunk(chunk.decodedData);
    return isInitialized;
  }

  private async handleSync(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;
    try {
      const blob = await this.speechService.synthesize(promptArgs.prompt, promptArgs.voice);
      createdUrl = this.setAudioUrl(blob);
    } catch (e) {
      this.handlePlaybackError(e, createdUrl);
      throw e;
    }
  }

  private setRandomPlaybackRate(min = MIN_PLAYBACK_RATE, max = MAX_PLAYBACK_RATE) {
    const percent = 100;
    const rawRate = Math.random() * (max - min) + min;
    return Math.round(rawRate * percent) / percent;
  }

  private async handleStream(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;
    let finalBlob: Blob | undefined = undefined;
    let isInitialized = false;
    try {
      const { prompt, voice, shouldWait = false } = promptArgs;
      const playbackRate = shouldWait ? 1 : this.setRandomPlaybackRate();

      for await (const chunk of this.speechService.synthesizeStream(prompt, voice, shouldWait)) {
        if (chunk instanceof Blob) {
          finalBlob = chunk;
        } else if (chunk) {
          isInitialized = this.processStreamChunk(isInitialized, playbackRate, chunk);
        }
      }
      if (shouldWait) {
        await this.audioPlayerService.awaitPlaybackComplete();
        createdUrl = this.setAudioUrl(finalBlob);
      }
    } catch (e) {
      this.handlePlaybackError(e, createdUrl);
      throw e;
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
    if (!promptArgs.fact) {
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
          await this.handleStream({ ...promptArgs, shouldWait: true });
          break;
        case 'web_audio_api':
          await this.handleStream(promptArgs);
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
