import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SAMPLE_RATE,
  PLAYBACK_POLL_INTERVAL,
} from '@/core/constants/text-to-speech.constant';
import { AudioStreamChunk } from '@/core/interfaces/text-to-speech.interface';
import { normalizePcmSamples } from '@/core/utils/audio.util';
import { AudioPlaybackOptions } from '@/shared/interfaces/audio-playback-options.interface';
import { DestroyRef, inject, Service } from '@angular/core';
import { EmptyError, interval, lastValueFrom, map, takeWhile } from 'rxjs';

@Service()
export class AudioPlayerService {
  #audioCtx: AudioContext | undefined = undefined;
  #nextStartTime = 0;
  #playbackRate = DEFAULT_PLAYBACK_RATE;
  #activeSources: AudioBufferSourceNode[] = [];
  readonly #destroyRef$ = inject(DestroyRef);

  readonly #playbackCheck$ = interval(PLAYBACK_POLL_INTERVAL).pipe(
    map(() => (this.#audioCtx ? this.#nextStartTime - this.#audioCtx.currentTime : 0)),
    takeWhile((remainingTime) => remainingTime > 0),
  );

  constructor() {
    this.#destroyRef$.onDestroy(() => this.stopAll());
  }

  private initializeContext(sampleRate: number): void {
    this.#audioCtx = new AudioContext({ sampleRate });
    this.#nextStartTime = this.#audioCtx.currentTime;
  }

  private isAborted(signal: AbortSignal | undefined): boolean {
    return signal ? signal.aborted : false;
  }

  private async consumeStreamChunks(
    stream: AsyncIterable<AudioStreamChunk>,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    for await (const chunk of stream) {
      if (this.isAborted(signal)) {
        this.stopAll();
        return;
      }

      if (!this.#audioCtx) {
        this.initializeContext(chunk.sampleRate);
      }

      this.processChunk(chunk.decodedData);
    }
  }

  async playStream(stream: AsyncIterable<AudioStreamChunk>, options: AudioPlaybackOptions = {}): Promise<void> {
    const signal = options.signal;
    this.stopAll();
    this.#playbackRate = options.playbackRate || DEFAULT_PLAYBACK_RATE;

    if (this.isAborted(signal)) {
      return;
    }

    await this.consumeStreamChunks(stream, signal);

    if (!this.isAborted(signal)) {
      await this.awaitPlaybackComplete();
    }
  }

  initialize(sampleRate = DEFAULT_SAMPLE_RATE, playbackRate = DEFAULT_PLAYBACK_RATE): void {
    this.stopAll();
    this.#audioCtx = new AudioContext({ sampleRate });
    this.#nextStartTime = this.#audioCtx.currentTime;
    this.#playbackRate = playbackRate;
  }

  processChunk(rawBytes: Uint8Array): void {
    if (!this.#audioCtx) {
      return;
    }

    const float32Samples = normalizePcmSamples(rawBytes);
    if (float32Samples.length === 0) {
      return;
    }

    const buffer = this.#audioCtx.createBuffer(1, float32Samples.length, this.#audioCtx.sampleRate);
    buffer.copyToChannel(float32Samples as unknown as Float32Array<ArrayBuffer>, 0);

    const sourceNode = this.#audioCtx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.playbackRate.value = this.#playbackRate;
    sourceNode.connect(this.#audioCtx.destination);

    this.#activeSources.push(sourceNode);

    const playTime = Math.max(this.#nextStartTime, this.#audioCtx.currentTime);
    sourceNode.start(playTime);

    const duration = buffer.duration / this.#playbackRate;
    this.#nextStartTime = playTime + duration;

    sourceNode.onended = () => (this.#activeSources = this.#activeSources.filter((s) => s !== sourceNode));
  }

  stopAll(): void {
    this.#activeSources.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // Safe swallow for nodes already stopped
      }
    });

    this.#activeSources = [];
    this.#nextStartTime = 0;
    if (this.#audioCtx) {
      try {
        this.#audioCtx.close();
      } catch {
        // Safe swallow
      }
      this.#audioCtx = undefined;
    }
  }

  async awaitPlaybackComplete(): Promise<void> {
    if (!this.#audioCtx) {
      return;
    }

    try {
      await lastValueFrom(this.#playbackCheck$);
    } catch (e) {
      if (e instanceof EmptyError) {
        return;
      }
      throw e;
    }
  }
}
