import { Metadata } from './grounding.interface';
import { Recommendation } from './recommendation.interface';
import { TokenUsage } from './token-usage.interface';

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
}
