import { WINDOW } from '@/core/constants/navigator.const';
import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
import { inject, Service } from '@angular/core';
import type { GroundingMetadata, UsageMetadata, WebGroundingChunk } from 'firebase/ai';
import type {
  ImageAnalysis,
  ImageAnalysisResponse,
  TokenUsage,
  VisionGroundingMetadata,
} from './image-analysis.interface';
import { ImageAnalysisSchema } from './image-analysis.schema';
import { preprocessImageForVision } from './image.util';
import { altTextPrompt } from './vision.prompt';

@Service()
export class VisionService {
  readonly #window = inject(WINDOW);
  readonly #aiModelFactory = inject(AiModelFactory);

  async analyzeImage(image: File): Promise<ImageAnalysisResponse> {
    if (!image) {
      throw Error('image is required to generate texts.');
    }

    const { data, mimeType, optimizationMetrics } = await preprocessImageForVision(image, this.#window);
    const imagePart = {
      inlineData: {
        data,
        mimeType,
      },
    };

    const aiModel = await this.#aiModelFactory.getModel({
      schema: ImageAnalysisSchema,
      tools: [{ googleSearch: {} }],
    });
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
        optimizationMetrics,
      };
    }
    throw Error('No text generated.');
  }

  private constructCitations(groundingMetadata?: GroundingMetadata): VisionGroundingMetadata {
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

  private getTokenUsage(usageMetadata?: UsageMetadata): TokenUsage {
    return {
      input: usageMetadata?.promptTokenCount || 0,
      output: usageMetadata?.candidatesTokenCount || 0,
      thought: usageMetadata?.thoughtsTokenCount || 0,
      total: usageMetadata?.totalTokenCount || 0,
    };
  }
}
