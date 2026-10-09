import { Metadata } from '@/core/interfaces/grounding.interface';
import { Recommendation } from '@/core/interfaces/recommendation.interface';
import { TokenUsage } from '@/core/interfaces/token-usage.interface';
import { ImageOptimizationMetrics } from './image-processing.interface';

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
  metadata: Metadata;
  optimizationMetrics?: ImageOptimizationMetrics;
}
