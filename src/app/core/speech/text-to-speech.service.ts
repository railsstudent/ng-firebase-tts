import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
import { inject, Service } from '@angular/core';
import type {
  Content,
  GenerateContentRequest,
  GenerateContentResponse,
  GenerationConfig,
  GenerativeModel,
} from 'firebase/ai';
import { decodeAudioChunk, toWavBlob } from './audio.util';
import type { AudioStreamChunk, SpeechChunkData, SpeechPrompt } from './text-to-speech.interface';

interface AIModelGenerativeRequest {
  aiModel: GenerativeModel;
  generationRequest: GenerateContentRequest;
}

@Service()
export class TextToSpeechService {
  readonly #aiModelFactory = inject(AiModelFactory);

  private extractValidChunkData(chunk: GenerateContentResponse): SpeechChunkData | null {
    const inlineData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data || !inlineData?.mimeType) {
      return null;
    }
    return { data: inlineData.data, mimeType: inlineData.mimeType };
  }

  private async createAIModelGenerationRequest(text: string, voiceName: string): Promise<AIModelGenerativeRequest> {
    const aiModel = await this.#aiModelFactory.getTtsModel();
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
    const generationRequest: GenerateContentRequest = {
      contents,
      generationConfig,
    };

    return { aiModel, generationRequest };
  }

  /**
   * USE CASE 2 (Streamed Synthesis):
   * Yields decoded audio chunks as they arrive from the Gemini model.
   */
  async *synthesizeStream({ text, voice }: SpeechPrompt): AsyncGenerator<AudioStreamChunk> {
    const { aiModel, generationRequest } = await this.createAIModelGenerationRequest(text, voice);
    const responseStream = await aiModel.generateContentStream(generationRequest);

    for await (const chunk of responseStream.stream) {
      const chunkData = this.extractValidChunkData(chunk);
      if (chunkData) {
        const { data, mimeType } = chunkData;
        yield decodeAudioChunk(data, mimeType);
      }
    }
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, constructs a Blob, and returns it.
   */
  async synthesize({ text, voice }: SpeechPrompt): Promise<Blob> {
    try {
      const { aiModel, generationRequest } = await this.createAIModelGenerationRequest(text, voice);
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
