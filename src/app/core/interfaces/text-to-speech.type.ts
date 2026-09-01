export interface SpeechChunkData {
  data: string;
  mimeType: string;
}

export interface RawAudioBinary {
  decodedData: Uint8Array;
  sampleRate: number;
}
