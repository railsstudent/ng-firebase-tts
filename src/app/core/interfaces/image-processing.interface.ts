export interface Dimensions {
  width: number;
  height: number;
}

export interface OptimizationMetricsParams {
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  originalDimensions: Dimensions;
  optimizedDimensions: Dimensions;
}

export interface ImageOptimizationMetrics extends OptimizationMetricsParams {
  readonly estimatedOriginalTokens: number;
  readonly actualImageTokens: number;
  readonly tokensSaved: number;
  readonly bytesSavedPercent: number;
}

export interface ImageProcessingResult {
  data: string;
  mimeType: string;
  optimizationMetrics: ImageOptimizationMetrics;
}

export interface CompressedBlobResult {
  blob: Blob;
  mimeType: string;
}

export interface CompressOptions {
  dimensions: Dimensions;
  fallbackFile: File;
  win?: Window | null;
}

export interface WindowWithCanvas extends Window {
  OffscreenCanvas?: typeof OffscreenCanvas;
}
