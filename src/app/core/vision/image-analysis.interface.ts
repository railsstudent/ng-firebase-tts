import { WebGroundingChunk } from 'firebase/ai';
import { ImageOptimizationMetrics } from './image-processing.interface';

export interface GroundingMetadata {
  citations: WebGroundingChunk[];
  renderedContent: string;
  searchQueries: string[];
}

export interface Recommendation {
  id: number;
  text: string;
  reason: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  thought: number;
  total: number;
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
