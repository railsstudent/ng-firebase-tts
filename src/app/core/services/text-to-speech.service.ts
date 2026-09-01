import { AI_BACKEND } from '@/core/constants/firebase.constant';
import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary, SpeechChunkData } from '@/core/interfaces/text-to-speech.type';
import { decodeBase64 } from '@/core/utils/base64.util';
import { convertToWav, extractInlineData, parseMimeType } from '@/core/utils/mime-type.util';
import { inject, Service } from '@angular/core';
import { GenerateContentResponse, getGenerativeModel, ResponseModality } from 'firebase/ai';
import { ConfigService } from './config.service';

@Service()
export class TextToSpeechService {
  readonly #aiBackend = inject(AI_BACKEND);
  readonly #configService = inject(ConfigService);
  readonly #modelName = this.#configService.appConfig.geminiTTSModelName;

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const { data, mimeType } = extractInlineData(chunk);
    if (!data || !mimeType) {
      return null;
    }
    return { data, mimeType };
  }

  async *synthesizeStream(
    text: string,
    voiceName: string,
    shouldWait = true,
  ): AsyncGenerator<RawAudioBinary | Blob | undefined> {
    const model = this.createModel(voiceName);
    let chunks: Uint8Array = new Uint8Array(0);
    let firstMimeType = '';
    let sampleRate = DEFAULT_SAMPLE_RATE;

    const responseStream = await model.generateContentStream([text]);
    for await (const chunk of responseStream.stream) {
      const chunkData = this.extractValidChunkData(chunk);
      if (chunkData) {
        const { data, mimeType } = chunkData;
        const decodedData = decodeBase64(data);
        if (!firstMimeType && mimeType) {
          firstMimeType = mimeType;
          sampleRate = parseMimeType(firstMimeType).sampleRate;
        }

        if (shouldWait) {
          const mergedChunk = new Uint8Array(chunks.length + decodedData.length);
          mergedChunk.set(chunks);
          mergedChunk.set(decodedData, chunks.length);
          chunks = mergedChunk;
        }

        yield { decodedData, sampleRate };
      }
    }

    const finalBlob = shouldWait ? convertToWav(chunks, firstMimeType) : undefined;
    yield finalBlob;
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
