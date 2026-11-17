import type {
  CompressedBlobResult,
  CompressOptions,
  Dimensions,
  ImageOptimizationMetrics,
  ImageProcessingResult,
  OptimizationMetricsParams,
  WindowWithCanvas,
} from './image-processing.interface';

const ONE_DECIMAL_PLACE = 1;
const NOT_FOUND_INDEX = -1;
const PAYLOAD_OFFSET = 1;
const MAX_IMAGE_DIMENSION = 768;
const GEMINI_TILE_SIZE = 768;
const TOKENS_PER_IMAGE_TILE = 258;
const TARGET_IMAGE_MIME = 'image/webp';
const FALLBACK_IMAGE_MIME = 'image/jpeg';
const IMAGE_COMPRESSION_QUALITY = 0.8;
const CLASSIFIER_IMAGE_MIME = 'image/png';
const PERCENT = 100;

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

export async function preprocessImageForVision(file: File, win?: Window | null): Promise<ImageProcessingResult> {
  const { bitmap, dimensions: originalDimensions } = await decodeSourceBitmap(file, win);
  const optimizedDimensions: Dimensions = calculateTargetDimensions(originalDimensions);
  const {
    blob: optimizedBlob,
    mimeType,
    classifierBlob,
  } = await compressBitmapToBlob(bitmap, {
    dimensions: optimizedDimensions,
    fallbackFile: file,
    win,
  });

  const [base64Data, classifierArrayBuffer] = await Promise.all([
    blobToBase64(optimizedBlob),
    classifierBlob.arrayBuffer(),
  ]);
  const imageBytes = new Uint8Array(classifierArrayBuffer);
  const optimizationMetrics: ImageOptimizationMetrics = calculateOptimizationMetrics({
    originalSizeBytes: file.size,
    optimizedSizeBytes: optimizedBlob.size,
    originalDimensions,
    optimizedDimensions,
  });

  return {
    data: base64Data,
    mimeType,
    imageBytes,
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
      classifierBlob: fallbackFile,
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
  const classifierBlobPromise = canvas.convertToBlob({ type: CLASSIFIER_IMAGE_MIME }).catch(() => fallbackFile);

  for (const mimeType of [TARGET_IMAGE_MIME, FALLBACK_IMAGE_MIME]) {
    try {
      const [blob, classifierBlob] = await Promise.all([
        canvas.convertToBlob({
          type: mimeType,
          quality: IMAGE_COMPRESSION_QUALITY,
        }),
        classifierBlobPromise,
      ]);
      return { blob, mimeType, classifierBlob };
    } catch {
      // Try next MIME type
    }
  }

  const classifierBlob = await classifierBlobPromise;
  return {
    blob: fallbackFile,
    mimeType: fallbackFile.type || FALLBACK_IMAGE_MIME,
    classifierBlob,
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
