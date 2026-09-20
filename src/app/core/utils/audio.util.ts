import { PCM_SPEC, RADIX_DECIMAL, WAV_SPEC } from '@/core/constants/audio.constant';
import { DEFAULT_AUDIO_TYPE, DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { AudioStreamChunk } from '@/core/interfaces/text-to-speech.interface';
import { WavConversionOptions } from '@/shared/interfaces/wav-conversion-options.interface';

interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}

function isBlobPart(value: unknown): value is BlobPart {
  return (
    typeof value === 'string' || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)
  );
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i = i + 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseBitsPerSample(baseType: string): number {
  const format = baseType.split('/')[1];
  if (format && format.toLowerCase().startsWith('l')) {
    const bits = parseInt(format.slice(1), RADIX_DECIMAL);
    if (!isNaN(bits)) {
      return bits;
    }
  }
  return WAV_SPEC.DEFAULT_BITS_PER_SAMPLE;
}

function parseMimeType(mimeType: string): ParsedMimeType {
  const parts = mimeType.split(';');
  const baseType = parts[0]?.trim() || DEFAULT_AUDIO_TYPE;
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let numChannels = 1;
  const bitsPerSample = parseBitsPerSample(baseType);

  for (const part of parts.slice(1)) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (key === 'rate' && value) {
      sampleRate = parseInt(value, RADIX_DECIMAL) || sampleRate;
    } else if (key === 'channels' && value) {
      numChannels = parseInt(value, RADIX_DECIMAL) || numChannels;
    }
  }

  return { baseType, sampleRate, numChannels, bitsPerSample };
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Uint8Array {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / WAV_SPEC.BITS_PER_BYTE;
  const blockAlign = (numChannels * bitsPerSample) / WAV_SPEC.BITS_PER_BYTE;

  const buffer = new ArrayBuffer(WAV_SPEC.HEADER_SIZE);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i = i + 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // ChunkID 'RIFF' (0x52, 0x49, 0x46, 0x46)
  writeString(WAV_SPEC.OFFSET.CHUNK_ID, 'RIFF');
  // ChunkSize: 36 + dataLength
  view.setUint32(WAV_SPEC.OFFSET.CHUNK_SIZE, WAV_SPEC.PAYLOAD_OFFSET + dataLength, true);
  // Format 'WAVE' (0x57, 0x41, 0x56, 0x45)
  writeString(WAV_SPEC.OFFSET.FORMAT, 'WAVE');
  // Subchunk1ID 'fmt '
  writeString(WAV_SPEC.OFFSET.FMT_ID, 'fmt ');
  // Subchunk1Size (16 for PCM)
  view.setUint32(WAV_SPEC.OFFSET.FMT_SIZE, WAV_SPEC.FMT_SUBCHUNK_SIZE, true);
  // AudioFormat (1 for PCM)
  view.setUint16(WAV_SPEC.OFFSET.AUDIO_FORMAT, 1, true);
  // NumChannels
  view.setUint16(WAV_SPEC.OFFSET.NUM_CHANNELS, numChannels, true);
  // SampleRate
  view.setUint32(WAV_SPEC.OFFSET.SAMPLE_RATE, sampleRate, true);
  // ByteRate
  view.setUint32(WAV_SPEC.OFFSET.BYTE_RATE, byteRate, true);
  // BlockAlign
  view.setUint16(WAV_SPEC.OFFSET.BLOCK_ALIGN, blockAlign, true);
  // BitsPerSample
  view.setUint16(WAV_SPEC.OFFSET.BITS_PER_SAMPLE, bitsPerSample, true);
  // Subchunk2ID 'data'
  writeString(WAV_SPEC.OFFSET.DATA_ID, 'data');
  // Subchunk2Size
  view.setUint32(WAV_SPEC.OFFSET.DATA_SIZE, dataLength, true);

  return new Uint8Array(buffer);
}

/**
 * Normalizes raw 16-bit linear PCM byte buffers (Uint8Array) into Float32Array samples
 * scaled between -1.0 and 1.0, ensuring safe even-byte boundaries.
 */
export function normalizePcmSamples(rawBytes: Uint8Array, gain = 1): Float32Array<ArrayBuffer> {
  const byteLength =
    rawBytes.byteLength % PCM_SPEC.BYTES_PER_INT16 === 0 ? rawBytes.byteLength : rawBytes.byteLength - 1;
  const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, byteLength / PCM_SPEC.BYTES_PER_INT16);
  const float32Data = new Float32Array(int16Data.length) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < int16Data.length; i = i + 1) {
    const normalized = (int16Data[i] / PCM_SPEC.NORMALIZATION_BASE) * gain;
    float32Data[i] = Math.max(PCM_SPEC.MIN_CLAMP, Math.min(PCM_SPEC.MAX_CLAMP, normalized));
  }
  return float32Data;
}

/**
 * Decodes a Gemini base64 audio chunk and extracts its sample rate.
 */
export function decodeAudioChunk(base64Data: string, mimeType = DEFAULT_AUDIO_TYPE): AudioStreamChunk {
  const decodedData = decodeBase64(base64Data);
  const sampleRate = mimeType ? parseMimeType(mimeType).sampleRate : DEFAULT_SAMPLE_RATE;
  return { decodedData, sampleRate, mimeType };
}

/**
 * Converts Linear PCM bytes (Uint8Array, array of Uint8Array chunks, or base64) into an audio/wav Blob with a 44-byte RIFF header.
 */
export function toWavBlob(rawData: Uint8Array | Uint8Array[] | string, mimeType: string): Blob {
  let pcmBytes: Uint8Array;

  if (Array.isArray(rawData)) {
    const totalLength = rawData.reduce((acc, chunk) => acc + chunk.length, 0);
    pcmBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of rawData) {
      pcmBytes.set(chunk, offset);
      offset = offset + chunk.length;
    }
  } else if (typeof rawData === 'string') {
    pcmBytes = decodeBase64(rawData);
  } else {
    pcmBytes = rawData;
  }

  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(pcmBytes.length, options);

  if (!isBlobPart(wavHeader) || !isBlobPart(pcmBytes)) {
    throw new Error('Header or raw data is not a valid BlobPart.');
  }

  return new Blob([wavHeader, pcmBytes], { type: 'audio/wav' });
}
