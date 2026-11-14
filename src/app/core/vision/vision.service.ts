import { WINDOW } from '@/core/constants/navigator.const';
import { AiModelFactory } from '@/core/firebase/ai-model-factory.service';
import type { AiModelOptions } from '@/core/firebase/ai-model-options.interface';
import { inject, Service } from '@angular/core';
import type {
  GoogleMapsGroundingChunk,
  GroundingMetadata,
  InlineDataPart,
  UsageMetadata,
  WebGroundingChunk,
} from 'firebase/ai';
import type {
  CategoryModelConfig,
  ImageAnalysis,
  ImageAnalysisResponse,
  TokenUsage,
  VisionGroundingMetadata,
} from './image-analysis.interface';
import { ImageAnalysisSchema } from './image-analysis.schema';
import type { ImageSubjectCategory } from './image-category.type';
import { ImageClassifierService } from './image-classifier.service';
import { preprocessImageForVision } from './image.util';
import {
  altTextPrompt,
  peopleAltTextPrompt,
  peopleSystemInstruction,
  placeAltTextPrompt,
  placeSystemInstruction,
} from './vision.prompt';

@Service()
export class VisionService {
  readonly #window = inject(WINDOW);
  readonly #aiModelFactory = inject(AiModelFactory);
  readonly #imageClassifierService = inject(ImageClassifierService);

  async analyzeImage(image: File): Promise<ImageAnalysisResponse> {
    if (!image) {
      throw Error('image is required to generate texts.');
    }

    const { data, mimeType, optimizationMetrics, imageBytes } = await preprocessImageForVision(image, this.#window);
    const category = await this.#imageClassifierService.classifyImage(imageBytes);
    const { options, prompt } = this.getCategoryModelConfig(category);

    const imagePart: InlineDataPart = {
      type: 'inlineData',
      inlineData: {
        data,
        mimeType,
      },
    };

    const aiModel = await this.#aiModelFactory.getModel(options);
    const result = await aiModel.generateContent([prompt, imagePart]);

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
        category,
      };
    }
    throw Error('No text generated.');
  }

  private getCategoryModelConfig(category: ImageSubjectCategory): CategoryModelConfig {
    const options: AiModelOptions = {
      schema: ImageAnalysisSchema,
      tools: [{ googleSearch: {} }],
    };

    switch (category) {
      case 'people':
        return {
          options: {
            ...options,
            systemInstruction: peopleSystemInstruction,
          },
          prompt: peopleAltTextPrompt,
        };
      case 'place':
        return {
          options: {
            systemInstruction: placeSystemInstruction,
            schema: ImageAnalysisSchema,
            tools: [{ googleMaps: {} }, { googleSearch: {} }],
          },
          prompt: placeAltTextPrompt,
        };
      default:
        return {
          options,
          prompt: altTextPrompt,
        };
    }
  }

  private constructCitations(groundingMetadata?: GroundingMetadata): VisionGroundingMetadata {
    if (!groundingMetadata) {
      return {
        citations: [],
        mapsCitations: [],
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
    const mapsCitations = supports.flatMap((support) =>
      (support.groundingChunkIndices || [])
        .map((idx) => chunks[idx]?.maps)
        .filter((maps): maps is GoogleMapsGroundingChunk => !!maps),
    );

    const renderedContent = groundingMetadata.searchEntryPoint?.renderedContent || '';
    const searchQueries = (groundingMetadata.webSearchQueries || []).filter((query) => !!query);

    return {
      citations,
      mapsCitations,
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
