/* eslint-disable @typescript-eslint/no-magic-numbers */
import { DEFAULT_AUDIO_TYPE, DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { isBlobPart } from '@/core/utils/base64.util';
import { WavConversionOptions } from '@/shared/interfaces/wav-conversion-options.interface';
import { GenerateContentResponse } from 'firebase/ai';

export interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}

function parseBitsPerSample(baseType: string): number {
  const format = baseType.split('/')[1];
  if (format && format.toLowerCase().startsWith('l')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      return bits;
    }
  }
  return 16; // default fallback
}

export function parseMimeType(mimeType: string): ParsedMimeType {
  const parts = mimeType.split(';');
  const baseType = parts[0]?.trim() || DEFAULT_AUDIO_TYPE;
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let numChannels = 1;
  const bitsPerSample = parseBitsPerSample(baseType);

  for (const part of parts.slice(1)) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (key === 'rate') {
      sampleRate = parseInt(value, 10) || sampleRate;
    } else if (key === 'channels') {
      numChannels = parseInt(value, 10) || numChannels;
    }
  }

  return { baseType, sampleRate, numChannels, bitsPerSample };
}

export function createWavHeader(dataLength: number, options: WavConversionOptions): Uint8Array {
  const { numChannels, sampleRate, bitsPerSample } = options;

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i = i + 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF'); // ChunkID
  view.setUint32(4, 36 + dataLength, true); // ChunkSize
  writeString(8, 'WAVE'); // Format
  writeString(12, 'fmt '); // Subchunk1ID
  view.setUint32(16, 16, true); // Subchunk1Size (PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample
  writeString(36, 'data'); // Subchunk2ID
  view.setUint32(40, dataLength, true); // Subchunk2Size

  return new Uint8Array(buffer);
}

export function convertToWav(rawData: Uint8Array, mimeType: string): Blob {
  console.debug('[MimeType] Converting raw audio data to WAV format...', { mimeType });
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, {
    sampleRate: options.sampleRate,
    numChannels: options.numChannels,
    bitsPerSample: options.bitsPerSample,
  });

  if (!isBlobPart(wavHeader) || !isBlobPart(rawData)) {
    throw new Error('Header or raw data is not a valid BlobPart.');
  }

  return new Blob([wavHeader, rawData], { type: 'audio/wav' });
}

export function extractInlineData(chunk: GenerateContentResponse) {
  const inlinenData = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (inlinenData) {
    return { data: inlinenData.data, mimeType: inlinenData.mimeType };
  }
  return { data: undefined, mimeType: undefined };
}
