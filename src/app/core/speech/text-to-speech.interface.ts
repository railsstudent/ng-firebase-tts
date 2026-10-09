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
