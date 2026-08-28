import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { decodeBase64 } from '@/core/utils/base64.util';
import { convertToWav, extractInlineData, parseMimeType } from '@/core/utils/mime-type.util';
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
    let initialized = false;
    const model = this.createModel(voiceName, this.#modelName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const { data, mimeType } = extractInlineData(chunk);
        if (!data || !mimeType) {
          continue;
        }

        if (!initialized) {
          this.initializeAudioPlayer(mimeType);
          initialized = true;
        }

        if (data) {
          this.#audioPlayer.processChunk(decodeBase64(data));
        }
      }
    } catch (e) {
      console.error('Streaming playback failed:', e);
      this.#audioPlayer.stopAll();
      throw e;
    }
  }

  private initializeAudioPlayer(mimeType: string) {
    const sampleRate = mimeType ? parseMimeType(mimeType).sampleRate : DEFAULT_SAMPLE_RATE;
    this.#audioPlayer.initialize(sampleRate);
  }

  /**
   * USE CASE 2 (Stream-and-Stitch):
   * Streams chunks from Gemini, aggregates them, and returns a unified Blob.
   */
  async synthesizeStream(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName, this.#modelName);
    let chunks: Uint8Array = new Uint8Array(0);
    let firstMimeType = '';

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const { data, mimeType } = extractInlineData(chunk);
        if (!data || !mimeType) {
          continue;
        }

        if (!firstMimeType && mimeType) {
          firstMimeType = mimeType;
        }

        const decodedData = decodeBase64(data);
        const mergedChunk = new Uint8Array(chunks.length + decodedData.length);
        mergedChunk.set(chunks);
        mergedChunk.set(decodedData, chunks.length);
        chunks = mergedChunk;
      }

      return convertToWav(chunks, firstMimeType);
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
      const { data, mimeType } = extractInlineData(result.response);
      if (!data || !mimeType) {
        throw new Error('No audio data received in response.');
      }

      const rawBytes = decodeBase64(data);
      return convertToWav(rawBytes, mimeType);
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
