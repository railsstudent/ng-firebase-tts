import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { decodeBase64, decodeBase64AsBlobPart } from '@/core/utils/base64.util';
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
  readonly #modelName = getValue(this.#configService.remoteConfig, 'geminiTTSModelName').asString();

  /**
   * USE CASE 3 (Zero-Latency Playback):
   * Streams voice content chunk-by-chunk and plays it immediately.
   */
  async speak(text: string, voiceName: string): Promise<void> {
    this.#audioPlayer.initialize(DEFAULT_SAMPLE_RATE);
    const model = this.createModel(voiceName, this.#modelName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const base64Data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const rawBytes = decodeBase64(base64Data);
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
   * USE CASE 2 (Stream-and-Stitch):
   * Streams chunks from Gemini, aggregates them, and returns a unified Blob.
   */
  async synthesizeStream(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName, this.#modelName);
    const chunks: BlobPart[] = [];

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const base64Data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const rawBytes = decodeBase64AsBlobPart(base64Data);
          chunks.push(rawBytes);
        }
      }
      return new Blob(chunks, { type: 'audio/pcm' });
    } catch (e) {
      console.error('Streaming synthesis failed:', e);
      throw e;
    }
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, constructs a Blob, and returns it.
   */
  async synthesize(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName, this.#modelName);

    try {
      const result = await model.generateContent([text]);
      const base64Data = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Data) {
        throw new Error('No audio data received in response.');
      }

      const rawBytes = decodeBase64AsBlobPart(base64Data);
      return new Blob([rawBytes], { type: 'audio/pcm' });
    } catch (e) {
      console.error('Ad-hoc single-shot synthesis failed:', e);
      throw e;
    }
  }

  private createModel(voiceName: string, modelName: string) {
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
}
