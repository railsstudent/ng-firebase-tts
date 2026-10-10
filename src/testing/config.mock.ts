import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.interface';
import { ThinkingLevel } from 'firebase/ai';
import { vi } from 'vitest';

export interface MockConfigServiceOptions {
  appConfig?: Partial<AppRemoteConfig>;
  aiBackend?: unknown;
  app?: unknown;
}

export function createMockAppRemoteConfig(overrides?: Partial<AppRemoteConfig>): AppRemoteConfig {
  return {
    vertexAILocation: 'us-central1',
    geminiModelName: 'gemini-2.5-flash',
    geminiTTSModelName: 'gemini-2.0-flash-exp',
    thinkingLevel: ThinkingLevel.LOW,
    useLimitedUseAppCheckTokens: true,
    ...(overrides ?? {}),
  };
}

export function createMockAiBackend(customApp?: unknown) {
  return {
    backend: {
      backendType: 'VERTEX',
    },
    backendType: 'VERTEX',
    app: customApp ?? {
      options: {
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        appId: 'test-app-id',
      },
    },
  };
}

export function createMockConfigService(options?: MockConfigServiceOptions) {
  const currentAppConfig = createMockAppRemoteConfig(options?.appConfig);
  const defaultAiBackend = createMockAiBackend(options?.app);

  return {
    get appConfig() {
      return currentAppConfig;
    },
    initialize: vi.fn(),
    getApp: vi.fn().mockResolvedValue(options?.app ?? {}),
    getAiBackend: vi.fn().mockResolvedValue(options?.aiBackend ?? defaultAiBackend),
  };
}
