export interface SpeechPrompt {
  text: string;
  voice: string;
}

export interface AudioStreamChunk {
  decodedData: Uint8Array;
  sampleRate: number;
  mimeType: string;
}

export interface SpeechChunkData {
  data: string;
  mimeType: string;
}

export interface AudioPlaybackOptions {
  playbackRate?: number;
  signal?: AbortSignal;
}

export interface WavConversionOptions {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
}

export interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}
