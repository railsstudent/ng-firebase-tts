import type { ImageSubjectCategory } from '@/core/vision/image-category.type';
import type { ImageClassifierService } from '@/core/vision/image-classifier.service';
import { vi } from 'vitest';

export interface MockImageClassifierService {
  classifyImage: ReturnType<typeof vi.fn>;
}

export function createMockImageClassifierService(
  defaultCategory: ImageSubjectCategory = 'general',
): MockImageClassifierService {
  return {
    classifyImage: vi.fn().mockResolvedValue(defaultCategory),
  } satisfies Partial<ImageClassifierService>;
}
