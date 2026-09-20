import { RawAudioBinary, SpeechChunkData, TextVoiceInput } from '@/core/interfaces/text-to-speech.interface';
import { ConfigService } from '@/core/services/config.service';
import { decodeAudioChunk, toWavBlob } from '@/core/utils/audio.util';
import { inject, Service } from '@angular/core';
import { AI, GenerateContentResponse, getGenerativeModel, ResponseModality } from 'firebase/ai';

@Service()
export class TextToSpeechService {
  readonly #configService = inject(ConfigService);

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data || !inlineData?.mimeType) {
      return null;
    }
    return { data: inlineData.data, mimeType: inlineData.mimeType };
  }

  /**
   * USE CASE 2 (Hybrid Stream-and-Play & Zero-Latency Stream):
   * Yields decoded audio chunks as they arrive from the Gemini model, and yields
   * the completed WAV Blob at the end when `shouldWait` is true.
   */
  async *synthesizeStream(textVoiceInput: TextVoiceInput): AsyncGenerator<RawAudioBinary | Blob | undefined> {
    const { text, voice, shouldWait = true } = textVoiceInput;
    let chunks: Uint8Array = new Uint8Array(0);
    let firstMimeType = '';

    const aiBackend = await this.#configService.getAiBackend();
    const model = this.createModel(aiBackend, voice);
    const responseStream = await model.generateContentStream([text]);

    for await (const chunk of responseStream.stream) {
      const chunkData = this.extractValidChunkData(chunk);
      if (chunkData) {
        const { data, mimeType } = chunkData;
        const decoded = decodeAudioChunk(data, mimeType);

        if (!firstMimeType && mimeType) {
          firstMimeType = mimeType;
        }

        if (shouldWait) {
          const mergedChunk = new Uint8Array(chunks.length + decoded.decodedData.length);
          mergedChunk.set(chunks);
          mergedChunk.set(decoded.decodedData, chunks.length);
          chunks = mergedChunk;
        }

        yield decoded;
      }
    }

    const finalBlob = shouldWait ? toWavBlob(chunks, firstMimeType) : undefined;
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
      return toWavBlob(chunk.data, chunk.mimeType);
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
