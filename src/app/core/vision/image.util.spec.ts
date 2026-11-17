import { preprocessImageForVision } from './image.util';

interface MockOffscreenCanvasInstance {
  getContext: ReturnType<typeof vi.fn>;
  convertToBlob: ReturnType<typeof vi.fn>;
}

describe('image.util', () => {
  describe('preprocessImageForVision', () => {
    it('should process image and return base64 and metrics with mock window OffscreenCanvas', async () => {
      const dummyBlob = new Blob(['mock-binary-data'], { type: 'image/jpeg' });
      const dummyFile = new File([dummyBlob], 'test-photo.jpg', { type: 'image/jpeg' });

      const mockBitmap = {
        width: 1536,
        height: 1024,
        close: vi.fn(),
      };

      const mockClassifierJpegBlob = new Blob(['jpeg-classifier-data'], { type: 'image/jpeg' });
      const mockConvertedBlob = new Blob(['optimized-data'], { type: 'image/webp' });
      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        convertToBlob: vi.fn(({ type }: ImageEncodeOptions = {}) =>
          Promise.resolve(type === 'image/webp' ? mockConvertedBlob : mockClassifierJpegBlob),
        ),
      };

      function MockOffscreenCanvas(): MockOffscreenCanvasInstance {
        return mockCanvasInstance;
      }

      const mockWindow = {
        createImageBitmap: vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
        OffscreenCanvas: MockOffscreenCanvas,
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);

      expect(result.data).toBeDefined();
      expect(result.mimeType).toBe('image/webp');
      expect(result.imageBytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result.imageBytes)).toBe('jpeg-classifier-data');
      expect(result.optimizationMetrics).toBeDefined();
      expect(result.optimizationMetrics.originalDimensions).toEqual({ width: 1536, height: 1024 });
      expect(result.optimizationMetrics.optimizedDimensions.width).toBe(768);
      expect(result.optimizationMetrics.optimizedDimensions.height).toBe(512);
      expect(result.optimizationMetrics.estimatedOriginalTokens).toBe(1032);
      expect(result.optimizationMetrics.actualImageTokens).toBe(258);
      expect(result.optimizationMetrics.tokensSaved).toBe(774);
      expect(mockBitmap.close).toHaveBeenCalled();
    });

    it('should fallback to JPEG if WebP conversion fails', async () => {
      const dummyBlob = new Blob(['mock-binary-data'], { type: 'image/jpeg' });
      const dummyFile = new File([dummyBlob], 'test-photo.jpg', { type: 'image/jpeg' });

      const mockBitmap = {
        width: 1000,
        height: 1000,
        close: vi.fn(),
      };

      const mockJpegBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        convertToBlob: vi.fn(({ type }: ImageEncodeOptions = {}) =>
          type === 'image/webp' ? Promise.reject(new Error('WebP unsupported')) : Promise.resolve(mockJpegBlob),
        ),
      };

      function MockOffscreenCanvas(): MockOffscreenCanvasInstance {
        return mockCanvasInstance;
      }

      const mockWindow = {
        createImageBitmap: vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
        OffscreenCanvas: MockOffscreenCanvas,
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);
      expect(result.mimeType).toBe('image/jpeg');
      expect(new TextDecoder().decode(result.imageBytes)).toBe('jpeg-data');
      expect(mockCanvasInstance.convertToBlob).toHaveBeenCalledTimes(2);
    });

    it('should safely fallback to raw file when window is null (SSR)', async () => {
      const dummyBlob = new Blob(['ssr-data'], { type: 'image/png' });
      const dummyFile = new File([dummyBlob], 'ssr-photo.png', { type: 'image/png' });

      const result = await preprocessImageForVision(dummyFile, null);

      expect(result.data).toBeDefined();
      expect(result.mimeType).toBe('image/png');
      expect(result.imageBytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result.imageBytes)).toBe('ssr-data');
      expect(result.optimizationMetrics.originalDimensions).toEqual({ width: 768, height: 768 });
    });

    it('should fallback to default dimensions if createImageBitmap fails during decode', async () => {
      const dummyBlob = new Blob(['corrupted-data'], { type: 'image/jpeg' });
      const dummyFile = new File([dummyBlob], 'corrupted.jpg', { type: 'image/jpeg' });

      const mockWindow = {
        createImageBitmap: vi.fn().mockRejectedValue(new Error('Corrupt image data')),
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);

      expect(result.data).toBeDefined();
      expect(result.optimizationMetrics.optimizedDimensions).toEqual({ width: 768, height: 768 });
    });

    it('should default to 768x768 when decoded bitmap has non-positive dimensions', async () => {
      const dummyFile = new File([new Blob(['data'], { type: 'image/jpeg' })], 'zero.jpg', { type: 'image/jpeg' });
      const mockBitmap = {
        width: 0,
        height: 0,
        close: vi.fn(),
      };
      const mockWindow = {
        createImageBitmap: vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);

      expect(result.optimizationMetrics.optimizedDimensions).toEqual({ width: 768, height: 768 });
      expect(mockBitmap.close).toHaveBeenCalled();
    });

    it('should fallback to original file if all canvas conversions fail', async () => {
      const dummyBlob = new Blob(['mock-binary-data'], { type: 'image/png' });
      const dummyFile = new File([dummyBlob], 'test-photo.png', { type: 'image/png' });

      const mockBitmap = {
        width: 1000,
        height: 1000,
        close: vi.fn(),
      };

      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        convertToBlob: vi.fn().mockRejectedValue(new Error('Conversion completely unsupported')),
      };

      function MockOffscreenCanvas(): MockOffscreenCanvasInstance {
        return mockCanvasInstance;
      }

      const mockWindow = {
        createImageBitmap: vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
        OffscreenCanvas: MockOffscreenCanvas,
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);

      expect(result.mimeType).toBe('image/png');
      expect(result.data).toBeDefined();
      expect(result.imageBytes.byteLength).toBeGreaterThan(0);
    });

    it('should return empty imageBytes when canvas conversions fail and fallbackFile is image/webp', async () => {
      const dummyBlob = new Blob(['webp-binary-data'], { type: 'image/webp' });
      const dummyFile = new File([dummyBlob], 'test-photo.webp', { type: 'image/webp' });

      const mockBitmap = {
        width: 1000,
        height: 1000,
        close: vi.fn(),
      };

      const mockCanvasInstance = {
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        convertToBlob: vi.fn().mockRejectedValue(new Error('Conversion completely unsupported')),
      };

      function MockOffscreenCanvas(): MockOffscreenCanvasInstance {
        return mockCanvasInstance;
      }

      const mockWindow = {
        createImageBitmap: vi.fn().mockResolvedValue(mockBitmap as unknown as ImageBitmap),
        OffscreenCanvas: MockOffscreenCanvas,
      } as unknown as Window;

      const result = await preprocessImageForVision(dummyFile, mockWindow);

      expect(result.mimeType).toBe('image/webp');
      expect(result.data).toBeDefined();
      expect(result.imageBytes.byteLength).toBe(0);
    });

    it('should return entire string if FileReader result does not contain comma separator', async () => {
      const dummyFile = new File(['test'], 'test.png', { type: 'image/png' });
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
        Object.defineProperty(this, 'result', { value: 'plainbase64stringwithoutcomma', writable: true });
        this.onloadend?.({} as ProgressEvent<FileReader>);
      });

      const result = await preprocessImageForVision(dummyFile, null);
      expect(result.data).toBe('plainbase64stringwithoutcomma');
      readSpy.mockRestore();
    });

    it('should reject if FileReader returns non-string result', async () => {
      const dummyFile = new File(['test'], 'test.png', { type: 'image/png' });
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
        Object.defineProperty(this, 'result', { value: null, writable: true });
        this.onloadend?.({} as ProgressEvent<FileReader>);
      });

      await expect(preprocessImageForVision(dummyFile, null)).rejects.toThrow('FileReader returned null result');
      readSpy.mockRestore();
    });

    it('should reject if FileReader triggers onerror', async () => {
      const dummyFile = new File(['test'], 'test.png', { type: 'image/png' });
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
        Object.defineProperty(this, 'error', { value: new Error('Disk read failed'), writable: true });
        this.onerror?.({} as ProgressEvent<FileReader>);
      });

      await expect(preprocessImageForVision(dummyFile, null)).rejects.toThrow('Disk read failed');
      readSpy.mockRestore();
    });
  });
});
