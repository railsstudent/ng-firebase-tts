import { Recommendation } from '@/core/interfaces/recommendation.interface';
import { TokenUsage } from '@/core/interfaces/token-usage.interface';
import { WebGroundingChunk } from 'firebase/ai';
import { ImageOptimizationMetrics } from './image-processing.interface';

export interface GroundingMetadata {
  citations: WebGroundingChunk[];
  renderedContent: string;
  searchQueries: string[];
}

export interface ImageAnalysis {
  alternativeText: string;
  tags: string[];
  recommendations: Recommendation[];
  fact: string;
}

export interface ImageAnalysisResponse {
  parsed: ImageAnalysis;
  thought: string;
  tokenUsage: TokenUsage;
  metadata: GroundingMetadata;
  optimizationMetrics?: ImageOptimizationMetrics;
}
