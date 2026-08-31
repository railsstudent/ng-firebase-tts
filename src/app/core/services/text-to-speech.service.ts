import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { ProcessedStreamChunk, SpeechChunkData } from '@/core/interfaces/text-to-speech.type';
import { decodeBase64 } from '@/core/utils/base64.util';
import { convertToWav, extractInlineData, parseMimeType } from '@/core/utils/mime-type.util';
import { inject, Service } from '@angular/core';
import { GenerateContentResponse, getGenerativeModel, ResponseModality } from 'firebase/ai';
import { AudioPlayerService } from './audio-player.service';
import { ConfigService } from './config.service';

@Service()
export class TextToSpeechService {
  readonly #aiBackend = inject(AI_BACKEND);
  readonly #audioPlayer = inject(AudioPlayerService);
  readonly #configService = inject(ConfigService);
  readonly #modelName = this.#configService.appConfig.geminiTTSModelName;

  /**
   * USE CASE 3 (Zero-Latency Playback):
   * Streams voice content chunk-by-chunk and plays it immediately.
   */
  async speak(text: string, voiceName: string): Promise<void> {
    let firstMimeType = '';
    const model = this.createModel(voiceName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const chunkData = this.extractValidChunkData(chunk);
        if (chunkData) {
          const result = this.processStreamChunk(chunkData, firstMimeType);
          firstMimeType = result.firstMimeType;
        }
      }
    } catch (e) {
      console.error('Streaming playback failed:', e);
      this.#audioPlayer.stopAll();
      throw e;
    }
  }

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const { data, mimeType } = extractInlineData(chunk);
    if (!data || !mimeType) {
      return null;
    }
    return { data, mimeType };
  }

  private processStreamChunk(chunk: SpeechChunkData, firstMimeType: string): ProcessedStreamChunk {
    const { data, mimeType } = chunk;
    let updatedMimeType = firstMimeType;

    if (!firstMimeType && mimeType) {
      updatedMimeType = mimeType;
      const sampleRate = mimeType ? parseMimeType(mimeType).sampleRate : DEFAULT_SAMPLE_RATE;
      this.#audioPlayer.initialize(sampleRate);
    }

    const decodedData = decodeBase64(data);
    this.#audioPlayer.processChunk(decodedData);
    return { decodedData, firstMimeType: updatedMimeType };
  }

  /**
   * USE CASE 2 (Stream-and-Stitch):
   * Streams chunks from Gemini, aggregates them, and returns a unified Blob.
   */
  async synthesizeStream(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName);
    let chunks: Uint8Array = new Uint8Array(0);
    let firstMimeType = '';

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const chunkData = this.extractValidChunkData(chunk);
        if (chunkData) {
          const { decodedData, firstMimeType: updatedMimeType } = this.processStreamChunk(
            chunkData,
            firstMimeType,
          );
          firstMimeType = updatedMimeType;

          const mergedChunk = new Uint8Array(chunks.length + decodedData.length);
          mergedChunk.set(chunks);
          mergedChunk.set(decodedData, chunks.length);
          chunks = mergedChunk;
        }
      }

      await this.#audioPlayer.awaitPlaybackComplete();

      return convertToWav(chunks, firstMimeType);
    } catch (e) {
      console.error('Streaming synthesis failed:', e);
      this.#audioPlayer.stopAll();
      throw e;
    }
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, constructs a Blob, and returns it.
   */
  async synthesize(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName);

    try {
      const result = await model.generateContent([text]);
      const chunk = this.extractValidChunkData(result.response);
      if (!chunk) {
        throw new Error('No audio data received in response.');
      }
      const { data, mimeType } = chunk;
      return convertToWav(decodeBase64(data), mimeType);
    } catch (e) {
      console.error('Ad-hoc single-shot synthesis failed:', e);
      throw e;
    }
  }

  private createModel(voiceName: string) {
    return getGenerativeModel(this.#aiBackend, {
      model: this.#modelName,
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
