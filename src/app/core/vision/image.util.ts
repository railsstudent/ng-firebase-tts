import {
  FALLBACK_IMAGE_MIME,
  GEMINI_TILE_SIZE,
  IMAGE_COMPRESSION_QUALITY,
  MAX_IMAGE_DIMENSION,
  PERCENT,
  TARGET_IMAGE_MIME,
  TOKENS_PER_IMAGE_TILE,
} from './image.constant';
import {
  CompressedBlobResult,
  CompressOptions,
  Dimensions,
  ImageOptimizationMetrics,
  ImageProcessingResult,
  OptimizationMetricsParams,
  WindowWithCanvas,
} from './image-processing.interface';

const BASE_UNIT = 1024;
const ONE_DECIMAL_PLACE = 1;
const NOT_FOUND_INDEX = -1;
const PAYLOAD_OFFSET = 1;

function calculateTargetDimensions(dimensions: Dimensions, maxDim: number = MAX_IMAGE_DIMENSION): Dimensions {
  const { width, height } = dimensions;
  if (width <= 0 || height <= 0) {
    return { width: maxDim, height: maxDim };
  }

  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: maxDim,
      height: Math.round(maxDim * (height / width)),
    };
  }

  return {
    width: Math.round(maxDim * (width / height)),
    height: maxDim,
  };
}

function calculateImageTokens(dimensions: Dimensions): number {
  const horizontalTiles = Math.max(1, Math.ceil(dimensions.width / GEMINI_TILE_SIZE));
  const verticalTiles = Math.max(1, Math.ceil(dimensions.height / GEMINI_TILE_SIZE));
  return horizontalTiles * verticalTiles * TOKENS_PER_IMAGE_TILE;
}

function calculateOptimizationMetrics(params: OptimizationMetricsParams): ImageOptimizationMetrics {
  const estimatedOriginalTokens = calculateImageTokens(params.originalDimensions);
  const actualImageTokens = calculateImageTokens(params.optimizedDimensions);
  const tokensSaved = Math.max(0, estimatedOriginalTokens - actualImageTokens);
  const bytesSaved = Math.max(0, params.originalSizeBytes - params.optimizedSizeBytes);
  const bytesSavedPercent =
    params.originalSizeBytes > 0
      ? Number(((bytesSaved / params.originalSizeBytes) * PERCENT).toFixed(ONE_DECIMAL_PLACE))
      : 0;

  return {
    ...params,
    estimatedOriginalTokens,
    actualImageTokens,
    tokensSaved,
    bytesSavedPercent,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const digitGroup = Math.min(Math.floor(Math.log(bytes) / Math.log(BASE_UNIT)), units.length - 1);
  const value = bytes / Math.pow(BASE_UNIT, digitGroup);
  const formatted = digitGroup === 0 ? value.toString() : Number(value.toFixed(ONE_DECIMAL_PLACE)).toString();
  return `${formatted} ${units[digitGroup]}`;
}

export async function preprocessImageForVision(file: File, win?: Window | null): Promise<ImageProcessingResult> {
  const { bitmap, dimensions: originalDimensions } = await decodeSourceBitmap(file, win);
  const optimizedDimensions: Dimensions = calculateTargetDimensions(originalDimensions);
  const { blob: optimizedBlob, mimeType } = await compressBitmapToBlob(bitmap, {
    dimensions: optimizedDimensions,
    fallbackFile: file,
    win,
  });

  const base64Data = await blobToBase64(optimizedBlob);
  const optimizationMetrics: ImageOptimizationMetrics = calculateOptimizationMetrics({
    originalSizeBytes: file.size,
    optimizedSizeBytes: optimizedBlob.size,
    originalDimensions,
    optimizedDimensions,
  });

  return {
    data: base64Data,
    mimeType,
    optimizationMetrics,
  };
}

async function decodeSourceBitmap(
  file: File,
  win?: Window | null,
): Promise<{ bitmap?: ImageBitmap; dimensions: Dimensions }> {
  if (win?.createImageBitmap) {
    try {
      const bitmap = await win.createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        bitmap,
        dimensions: { width: bitmap.width, height: bitmap.height },
      };
    } catch {
      // Fallback to default dimensions if decoding fails
    }
  }
  return {
    dimensions: { width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION },
  };
}

async function compressBitmapToBlob(
  bitmap: ImageBitmap | undefined,
  options: CompressOptions,
): Promise<CompressedBlobResult> {
  const { dimensions, fallbackFile, win } = options;
  const offscreenCanvasCtor = (win as WindowWithCanvas | null | undefined)?.OffscreenCanvas;
  if (!offscreenCanvasCtor || !bitmap) {
    bitmap?.close();
    return {
      blob: fallbackFile,
      mimeType: fallbackFile.type || FALLBACK_IMAGE_MIME,
    };
  }

  const canvas = new offscreenCanvasCtor(dimensions.width, dimensions.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
  }
  bitmap.close();

  return canvasToCompressedBlob(canvas, fallbackFile);
}

async function canvasToCompressedBlob(canvas: OffscreenCanvas, fallbackFile: File): Promise<CompressedBlobResult> {
  for (const mimeType of [TARGET_IMAGE_MIME, FALLBACK_IMAGE_MIME]) {
    try {
      const blob = await canvas.convertToBlob({
        type: mimeType,
        quality: IMAGE_COMPRESSION_QUALITY,
      });
      return { blob, mimeType };
    } catch {
      // Try next MIME type
    }
  }
  return {
    blob: fallbackFile,
    mimeType: fallbackFile.type || FALLBACK_IMAGE_MIME,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('FileReader returned null result'));
        return;
      }
      const commaIndex = reader.result.indexOf(',');
      if (commaIndex === NOT_FOUND_INDEX) {
        resolve(reader.result);
        return;
      }
      resolve(reader.result.slice(commaIndex + PAYLOAD_OFFSET));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to convert blob to base64'));
    reader.readAsDataURL(blob);
  });
}
