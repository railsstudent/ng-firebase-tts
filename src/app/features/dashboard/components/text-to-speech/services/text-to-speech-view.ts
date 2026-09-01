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

  private processStreamChunk(
    isInitialized: boolean,
    chunk: { decodedData: Uint8Array; sampleRate: number },
  ) {
    if (!isInitialized) {
      this.audioPlayerService.initialize(chunk.sampleRate);
      isInitialized = true;
    }
    this.audioPlayerService.processChunk(chunk.decodedData);
    return isInitialized;
  }

  private async handleSync(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;
    try {
      const blob = await this.speechService.synthesize(promptArgs.prompt, promptArgs.voice);
      createdUrl = this.setAudioUrl(blob, createdUrl);
    } catch (e) {
      this.handlePlaybackError(e, createdUrl);
      throw e;
    }
  }
  private async handleStream(promptArgs: FactConfig) {
    let createdUrl: string | undefined = undefined;
    let finalBlob: Blob | undefined = undefined;
    let isInitialized = false;
    try {
      for await (const chunk of this.speechService.synthesizeStream(
        promptArgs.prompt,
        promptArgs.voice,
      )) {
        if (chunk instanceof Blob) {
          finalBlob = chunk;
        } else {
          isInitialized = this.processStreamChunk(isInitialized, chunk);
        }
      }
      await this.audioPlayerService.awaitPlaybackComplete();
      createdUrl = this.setAudioUrl(finalBlob, createdUrl);
    } catch (e) {
      this.handlePlaybackError(e, createdUrl);
      throw e;
    }
  }

  private setAudioUrl(finalBlob: Blob | undefined, createdUrl: string | undefined) {
    if (finalBlob) {
      createdUrl = URL.createObjectURL(finalBlob);
      this.#audioUrl.set(createdUrl);
    }
    return createdUrl;
  }

  private async handleWebAudio(promptArgs: FactConfig) {
    let isInitialized = false;
    try {
      for await (const chunk of this.speechService.speak(promptArgs.prompt, promptArgs.voice)) {
        isInitialized = this.processStreamChunk(isInitialized, chunk);
      }
    } catch (e) {
      this.handlePlaybackError(e, '');
      throw e;
    }
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
          await this.handleStream(promptArgs);
          break;
        case 'web_audio_api':
          await this.handleWebAudio(promptArgs);
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
