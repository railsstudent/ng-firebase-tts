import { DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary, SpeechChunkData, TextVoiceInput } from '@/core/interfaces/text-to-speech.interface';
import { decodeBase64 } from '@/core/utils/base64.util';
import { convertToWav, extractInlineData, parseMimeType } from '@/core/utils/mime-type.util';
import { inject, Service } from '@angular/core';
import { AI, GenerateContentResponse, getGenerativeModel, ResponseModality } from 'firebase/ai';
import { ConfigService } from './config.service';

@Service()
export class TextToSpeechService {
  readonly #configService = inject(ConfigService);

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const { data, mimeType } = extractInlineData(chunk);
    if (!data || !mimeType) {
      return null;
    }
    return { data, mimeType };
  }

  async *synthesizeStream(textVoiceInput: TextVoiceInput): AsyncGenerator<RawAudioBinary | Blob | undefined> {
    const { text, voice, shouldWait = true } = textVoiceInput;
    let chunks: Uint8Array = new Uint8Array(0);
    let firstMimeType = '';
    let sampleRate = DEFAULT_SAMPLE_RATE;

    const aiBackend = await this.#configService.getAiBackend();
    const model = this.createModel(aiBackend, voice);
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
  async synthesize({ text, voice }: TextVoiceInput): Promise<Blob> {
    const aiBackend = await this.#configService.getAiBackend();
    const model = this.createModel(aiBackend, voice);

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

  private createModel(aiBackend: AI, voiceName: string) {
    return getGenerativeModel(aiBackend, {
      model: this.#configService.appConfig.geminiTTSModelName,
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
