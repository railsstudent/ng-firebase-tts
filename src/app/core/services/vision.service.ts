import { VISION_AI_MODEL } from '@/core/constants/firebase.constant';
import { ImageAnalysis, ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { fileToGenerativePart } from '@/core/utils/fileToPart.util';
import { inject, Service } from '@angular/core';
import { GenerativeModel, GroundingMetadata, UsageMetadata, WebGroundingChunk } from 'firebase/ai';

@Service()
export class VisionService {
  private aiModel: GenerativeModel = inject(VISION_AI_MODEL);

  async generateAltText(image: File): Promise<ImageAnalysisResponse> {
    if (!image) {
      throw Error('image is required to generate texts.');
    }

    const imagePart = await fileToGenerativePart(image);
    const altTextPrompt = `
You are asked to perform four tasks:
Task 1: Generate 1 - 3 sentences of alternative texts for the image provided, max 300 words.
Task 2: Generate at least 3 tags to describe the image.
Task 3: Based on the alternative text and tags, provide some suggestions to make the image more interesting and the reason to support them.
Task 4: Search for a surprising or obscure fact that interconnects the following tags. If a direct link doesn't exist, find a conceptual link between them.
`;
    const result = await this.aiModel.generateContent([altTextPrompt, imagePart]);

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
    const tokenUsage = {
      input: usageMetadata?.promptTokenCount || 0,
      output: usageMetadata?.candidatesTokenCount || 0,
      thought: usageMetadata?.thoughtsTokenCount || 0,
      total: usageMetadata?.totalTokenCount || 0,
    };
    return tokenUsage;
  }
}
