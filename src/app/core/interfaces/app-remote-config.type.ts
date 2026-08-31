import { ThinkingLevel } from 'firebase/ai';

export interface AppRemoteConfig {
  vertexAILocation: string;
  geminiModelName: string;
  geminiTTSModelName: string;
  thinkingLevel: ThinkingLevel;
  useLimitedUseAppCheckTokens: boolean;
}
