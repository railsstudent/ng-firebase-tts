import { ImageAnalysis, ImageAnalysisResponse } from '@/core/interfaces/image-analysis.interface';
import { ImageAnalysisSchema } from '@/core/schemas/image-analysis.schema';
import { ConfigService } from '@/core/services/config.service';
import { inject, Service } from '@angular/core';
import {
  AI,
  getGenerativeModel,
  GroundingMetadata,
  HarmBlockThreshold,
  HarmCategory,
  SafetySetting,
  UsageMetadata,
  WebGroundingChunk,
} from 'firebase/ai';

const NOT_FOUND_INDEX = -1;
const PAYLOAD_OFFSET = 1;

const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

@Service()
export class VisionService {
  readonly #configService = inject(ConfigService);

  async generateAltText(image: File): Promise<ImageAnalysisResponse> {
    if (!image) {
      throw Error('image is required to generate texts.');
    }

    const imagePart = await this.fileToGenerativePart(image);
    const altTextPrompt = `
You are asked to perform four tasks:
Task 1: Generate 1 - 3 sentences of alternative texts for the image provided, max 300 words.
Task 2: Generate at least 3 tags to describe the image.
Task 3: Based on the alternative text and tags, provide some suggestions to make the image more interesting and the reason to support them.
Task 4: Search for a surprising or obscure fact that interconnects the following tags. If a direct link doesn't exist, find a conceptual link between them.
`;
    const aiModel = this.getGenerativeAIModel(await this.#configService.getAiBackend());
    const result = await aiModel.generateContent([altTextPrompt, imagePart]);

    if (result?.response) {
      const response = result.response;
      const thought = response.thoughtSummary() || '';
      const text = response.text().replace(/```json\n?|```/g, '');
      const parsed: ImageAnalysis = JSON.parse(text);
      const tokenUsage = this.getTokenUsage(response.usageMetadata);
      const citations = this.constructCitations(response.candidates?.[0]?.groundingMetadata);

      return {
        parsed,
        thought,
        tokenUsage,
        metadata: citations,
      };
    }
    throw Error('No text generated.');
  }

  private async fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('FileReader returned null result'));
          return;
        }
        const commaIndex = reader.result.indexOf(',');
        if (commaIndex === NOT_FOUND_INDEX) {
          reject(new Error('FileReader result is not in expected format'));
          return;
        }
        resolve(reader.result.slice(commaIndex + PAYLOAD_OFFSET));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Disk read failure'));
      reader.readAsDataURL(file);
    });

    return {
      inlineData: { data, mimeType: file.type },
    };
  }

  private getGenerativeAIModel(backend: AI) {
    return getGenerativeModel(backend, {
      model: this.#configService.appConfig.geminiModelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: ImageAnalysisSchema,
        thinkingConfig: {
          thinkingLevel: this.#configService.appConfig.thinkingLevel,
          includeThoughts: true,
        },
      },
      safetySettings: SAFETY_SETTINGS,
      tools: [
        {
          googleSearch: {},
        },
      ],
    });
  }

  private constructCitations(groundingMetadata?: GroundingMetadata) {
    if (!groundingMetadata) {
      return {
        citations: [],
        renderedContent: '',
        searchQueries: [],
      };
    }

    const supports = groundingMetadata.groundingSupports || [];
    const chunks = groundingMetadata.groundingChunks || [];
    const citations = supports.flatMap((support) =>
      (support.groundingChunkIndices || [])
        .map((idx) => chunks[idx]?.web)
        .filter((web): web is WebGroundingChunk => !!web),
    );

    const renderedContent = groundingMetadata.searchEntryPoint?.renderedContent || '';
    const searchQueries = (groundingMetadata.webSearchQueries || []).filter((query) => !!query);

    return {
      citations,
      renderedContent,
      searchQueries,
    };
  }

  private getTokenUsage(usageMetadata?: UsageMetadata) {
    return {
      input: usageMetadata?.promptTokenCount || 0,
      output: usageMetadata?.candidatesTokenCount || 0,
      thought: usageMetadata?.thoughtsTokenCount || 0,
      total: usageMetadata?.totalTokenCount || 0,
    };
  }
}
