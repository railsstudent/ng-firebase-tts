import { SerializedBuffer } from './serialized-buffer.type';

export type StreamMessage =
  | {
      type: 'metadata';
      payload: {
        sampleRate: number;
      };
    }
  | {
      type: 'data';
      payload: {
        buffer: SerializedBuffer;
      };
    };
