import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { OnDestroy, Service, signal } from '@angular/core';

const AUDIO_NORMALIZATION_BASE = 32768.0;

const DEFAULT_PLAYBACK_RATE = 1;

@Service()
export class AudioPlayerService implements OnDestroy {
  #audioCtx: AudioContext | undefined = undefined;
  #nextStartTime = 0;
  #activeSources: AudioBufferSourceNode[] = [];

  #playbackRate = signal(DEFAULT_PLAYBACK_RATE);

  initialize(sampleRate = DEFAULT_SAMPLE_RATE): void {
    this.stopAll();
    this.#audioCtx = new AudioContext({ sampleRate });
    this.#nextStartTime = this.#audioCtx.currentTime;
  }

  processChunk(rawBytes: Uint8Array): void {
    if (!this.#audioCtx) {
      return;
    }

    const float32Samples = this.normalizeSamples(rawBytes);
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

  ngOnDestroy(): void {
    this.stopAll();
  }

  private normalizeSamples(rawBytes: Uint8Array): Float32Array<ArrayBuffer> {
    // Ensure even byte count for 16-bit PCM conversion
    const byteLength =
      rawBytes.byteLength % 2 === 0 ? rawBytes.byteLength : rawBytes.byteLength - 1;
    const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, byteLength / 2);
    const float32Data = new Float32Array(int16Data.length) as Float32Array<ArrayBuffer>;
    for (let i = 0; i < int16Data.length; i = i + 1) {
      float32Data[i] = int16Data[i] / AUDIO_NORMALIZATION_BASE;
    }
    return float32Data;
  }
}
