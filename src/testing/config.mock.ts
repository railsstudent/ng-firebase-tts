import type { AppRemoteConfig } from '@/core/firebase/app-remote-config.interface';
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

export interface MockAiBackend {
  backend: {
    backendType: string;
  };
  backendType: string;
  app: unknown;
}

export interface MockConfigService {
  readonly appConfig: AppRemoteConfig;
  initialize: ReturnType<typeof vi.fn>;
  getApp: ReturnType<typeof vi.fn>;
  getAiBackend: ReturnType<typeof vi.fn>;
}

export function createMockAiBackend(customApp?: unknown): MockAiBackend {
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

export function createMockConfigService(options?: MockConfigServiceOptions): MockConfigService {
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
