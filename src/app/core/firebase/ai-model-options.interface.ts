import type { SchemaRequest, Tool, TypedSchema } from 'firebase/ai';

export interface AiModelOptions {
  systemInstruction?: string;
  schema?: SchemaRequest | TypedSchema;
  tools?: Tool[];
}
