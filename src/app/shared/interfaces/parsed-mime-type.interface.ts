import { WavConversionOptions } from '@/shared/interfaces/wav-conversion-options.interface';

export interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}
