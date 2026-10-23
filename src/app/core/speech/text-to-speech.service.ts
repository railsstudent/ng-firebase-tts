import { injectAsync, Service } from '@angular/core';
import type {
  Content,
  GenerateContentRequest,
  GenerateContentResponse,
  GenerationConfig,
  GenerativeModel,
} from 'firebase/ai';
import { decodeAudioChunk, toWavBlob } from './audio.util';
import { AudioStreamChunk, SpeechChunkData, SpeechPrompt } from './text-to-speech.interface';

@Service()
export class TextToSpeechService {
  readonly #aiModelFactory = injectAsync(() =>
    import('@/core/firebase/ai-model-factory.service').then((m) => m.AiModelFactory),
  );

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data || !inlineData?.mimeType) {
      return null;
    }
    return { data: inlineData.data, mimeType: inlineData.mimeType };
  }

  /**
   * USE CASE 2 (Streamed Synthesis):
   * Yields decoded audio chunks as they arrive from the Gemini model.
   */
  async *synthesizeStream({ text, voice }: SpeechPrompt): AsyncGenerator<AudioStreamChunk> {
    const asyncAIModelFactory = await this.#aiModelFactory();
    const aiModel = await asyncAIModelFactory.getTtsModel();
    const generationRequest = this.createGenerationRequest(aiModel, text, voice);
    const responseStream = await aiModel.generateContentStream(generationRequest);

    for await (const chunk of responseStream.stream) {
      const chunkData = this.extractValidChunkData(chunk);
      if (chunkData) {
        const { data, mimeType } = chunkData;
        yield decodeAudioChunk(data, mimeType);
      }
    }
  }

  private createGenerationRequest(aiModel: GenerativeModel, text: string, voiceName: string): GenerateContentRequest {
    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            text,
          },
        ],
      },
    ];
    const generationConfig: GenerationConfig = {
      ...aiModel.generationConfig,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
        languageCode: 'en-US',
      },
    };

    return { contents, generationConfig };
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, constructs a Blob, and returns it.
   */
  async synthesize({ text, voice }: SpeechPrompt): Promise<Blob> {
    try {
      const asyncAIModelFactory = await this.#aiModelFactory();
      const aiModel = await asyncAIModelFactory.getTtsModel();

      const generationRequest = this.createGenerationRequest(aiModel, text, voice);
      const result = await aiModel.generateContent(generationRequest);
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
}
