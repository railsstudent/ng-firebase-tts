import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { inject, Service } from '@angular/core';
import { getGenerativeModel, ResponseModality } from 'firebase/ai';
import { getValue } from 'firebase/remote-config';
import { AudioPlayerService } from './audio-player.service';
import { ConfigService } from './config.service';

@Service()
export class TextToSpeechService {
  readonly #aiBackend = inject(AI_BACKEND);
  readonly #audioPlayer = inject(AudioPlayerService);
  readonly #configService = inject(ConfigService);

  /**
   * USE CASE 3 (Zero-Latency Playback):
   * Streams voice content chunk-by-chunk and plays it immediately.
   */
  async speak(text: string, voiceName: string): Promise<void> {
    this.#audioPlayer.initialize(DEFAULT_SAMPLE_RATE);
    const model = this.createModel(voiceName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const base64Data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const rawBytes = this.decodeBase64(base64Data);
          this.#audioPlayer.processChunk(rawBytes);
        }
      }
    } catch (e) {
      console.error('Streaming playback failed:', e);
      this.#audioPlayer.stopAll();
      throw e;
    }
  }

  /**
   * USE CASE 2 (Pure Streaming to Callback):
   * Streams raw bytes to a custom caller callback (e.g. for external visualizers).
   */
  async synthesizeStream(
    text: string,
    voiceName: string,
    onChunk: (rawBytes: Uint8Array) => void,
  ): Promise<void> {
    const model = this.createModel(voiceName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const base64Data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const rawBytes = this.decodeBase64(base64Data);
          onChunk(rawBytes);
        }
      }
    } catch (e) {
      console.error('Pure streaming failed:', e);
      throw e;
    }
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, constructs a Blob, and returns an Object URL.
   */
  async synthesize(text: string, voiceName: string): Promise<string> {
    const model = this.createModel(voiceName);

    try {
      const result = await model.generateContent([text]);
      const base64Data = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) {
        throw new Error('No audio data received in response.');
      }

      const rawBytes = this.decodeBase64(base64Data);
      const audioBlob = new Blob([rawBytes as unknown as BlobPart], { type: 'audio/pcm' });
      return URL.createObjectURL(audioBlob);
    } catch (e) {
      console.error('Ad-hoc single-shot synthesis failed:', e);
      throw e;
    }
  }

  private createModel(voiceName: string) {
    const modelName = getValue(this.#configService.remoteConfig, 'geminiTTSModelName').asString();
    return getGenerativeModel(this.#aiBackend, {
      model: modelName,
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
          languageCode: 'en-US',
        },
      },
    });
  }

  private decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i = i + 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
