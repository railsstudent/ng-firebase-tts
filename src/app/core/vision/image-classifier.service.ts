import { Service } from '@angular/core';
import type { ImageSubjectCategory } from './image-category.type';

@Service()
export class ImageClassifierService {
  classifyImage(imageBytes: Uint8Array): Promise<ImageSubjectCategory> {
    console.log('ImageClassifierService.classifyImage called with imageBytes of length:', imageBytes.length);
    return Promise.resolve('general');
  }
}
