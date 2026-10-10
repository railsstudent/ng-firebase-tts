import { WavConversionOptions } from './wav-conversion-options.interface';

export interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}
