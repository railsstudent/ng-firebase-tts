import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SAMPLE_RATE,
  PLAYBACK_POLL_INTERVAL,
} from '@/core/constants/text-to-speech.constant';
import { normalizePcmSamples } from '@/core/utils/pcm.util';
import { OnDestroy, Service, signal } from '@angular/core';
import { EmptyError, interval, lastValueFrom, map, takeWhile } from 'rxjs';

@Service()
export class AudioPlayerService implements OnDestroy {
  #audioCtx: AudioContext | undefined = undefined;
  #nextStartTime = 0;
  #activeSources: AudioBufferSourceNode[] = [];

  readonly #playbackCheck$ = interval(PLAYBACK_POLL_INTERVAL).pipe(
    map(() => (this.#audioCtx ? this.#nextStartTime - this.#audioCtx.currentTime : 0)),
    takeWhile((remainingTime) => remainingTime > 0),
  );

  #playbackRate = signal(DEFAULT_PLAYBACK_RATE);
  playbackRate = this.#playbackRate.asReadonly();

  initialize(sampleRate = DEFAULT_SAMPLE_RATE, playbackRate = DEFAULT_PLAYBACK_RATE): void {
    this.stopAll();
    this.#audioCtx = new AudioContext({ sampleRate });
    this.#nextStartTime = this.#audioCtx.currentTime;
    this.#playbackRate.set(playbackRate);
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
    sourceNode.playbackRate.value = this.#playbackRate();
    sourceNode.connect(this.#audioCtx.destination);

    this.#activeSources.push(sourceNode);

    const playTime = Math.max(this.#nextStartTime, this.#audioCtx.currentTime);
    sourceNode.start(playTime);

    const duration = buffer.duration / this.#playbackRate();
    this.#nextStartTime = playTime + duration;

    sourceNode.onended = () => {
      this.#activeSources = this.#activeSources.filter((s) => s !== sourceNode);
    };
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

  ngOnDestroy(): void {
    this.stopAll();
  }
}
