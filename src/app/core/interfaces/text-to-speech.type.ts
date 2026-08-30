export interface SpeechChunkData {
  data: string;
  mimeType: string;
}

export interface ProcessedStreamChunk {
  decodedData: Uint8Array;
  firstMimeType: string;
}
