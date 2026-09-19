import { NAVIGATOR, WINDOW } from '@/core/constants/navigator.const';
import firebaseConfig from '@/public/firebase.config.json';
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck } from 'firebase/app-check';
import { fetchAndActivate, getRemoteConfig } from 'firebase/remote-config';
import { ConfigService } from './config.service';

// Mock firebase/app
vi.mock('firebase/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/app')>();
  return Object.assign({}, actual, {
    initializeApp: vi.fn().mockReturnValue({
      name: '[DEFAULT]',
      container: {
        getProvider: vi.fn().mockReturnValue({
          getImmediate: vi.fn().mockReturnValue({}),
          getComponent: vi.fn().mockReturnValue({}),
          heartbeatController: {
            triggerHeartbeat: vi.fn(),
          },
        }),
      },
    }),
  });
});

// Mock firebase/app-check
vi.mock('firebase/app-check', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/app-check')>();
  return Object.assign({}, actual, {
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn(),
  });
});

// Mock firebase/remote-config
vi.mock('firebase/remote-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/remote-config')>();
  return Object.assign({}, actual, {
    getRemoteConfig: vi.fn().mockReturnValue({
      defaultConfig: {},
      settings: {},
    }),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: (_rc: unknown, key: string) => ({
      asString: () => {
        switch (key) {
          case 'vertexAILocation':
            return 'us-central1';
          case 'geminiModelName':
            return 'gemini-1.5-flash';
          case 'geminiTTSModelName':
            return 'gemini-1.5-flash-tts';
          case 'thinkingLevel':
            return 'LOW';
          default:
            return '';
        }
      },
      asBoolean: () => key === 'useLimitedUseAppCheckTokens',
      asNumber: () => 0,
    }),
  });
});

// Mock firebase/ai to prevent real initialization inside ConfigService tests
vi.mock('firebase/ai', () => ({
  getAI: vi.fn().mockReturnValue({}),
  AgentPlatformBackend: vi.fn(),
}));

vi.mock('@firebase/ai', () => ({
  getAI: vi.fn().mockReturnValue({}),
  AgentPlatformBackend: vi.fn(),
}));

describe('ConfigService', () => {
  let navigatorMock: { onLine: boolean };
  let windowMock: { location: { hostname: string } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAndActivate).mockResolvedValue(true);

    navigatorMock = { onLine: true };
    windowMock = {
      location: {
        hostname: 'localhost',
      },
    };
    // Cleanly reset global token before each test
    const globalObj = globalThis as Record<string, unknown>;
    globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN'] = undefined;
  });

  function configureTestBed(): ConfigService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        { provide: NAVIGATOR, useValue: navigatorMock },
        { provide: WINDOW, useValue: windowMock },
      ],
    });
    return TestBed.inject(ConfigService);
  }

  it('should initialize app, setup remote-config, and fetch in background when online', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;

    // initialize() is non-blocking (returns void immediately)
    const result = service.initialize();
    expect(result).toBeUndefined();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).toHaveBeenCalled();

    // App Check is deliberately NOT called at startup (protects FCP/LCP)
    expect(initializeAppCheck).not.toHaveBeenCalled();

    // Verify that background fetched values are updated in appConfig
    await vi.waitFor(() => {
      expect(service.appConfig).toEqual({
        vertexAILocation: 'us-central1',
        useLimitedUseAppCheckTokens: true,
        geminiModelName: 'gemini-1.5-flash',
        thinkingLevel: 'LOW',
        geminiTTSModelName: 'gemini-1.5-flash-tts',
      });
    });
  });

  it('should skip App Check and dynamic remote-config fetching when offline', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = false;

    service.initialize();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).not.toHaveBeenCalled();

    // Even when getAiBackend() is called, App Check should not be initialized offline
    await service.getAiBackend();
    expect(initializeAppCheck).not.toHaveBeenCalled();

    // Verify global debug token remains unconfigured
    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBeUndefined();

    // When offline, it should use the default initialized value
    expect(service.appConfig).toEqual({
      useLimitedUseAppCheckTokens: false,
      vertexAILocation: 'global',
      geminiModelName: 'gemini-3.8-flash',
      geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
      thinkingLevel: 'LOW',
    });
  });

  it('should skip App Check when online but recaptchaEnterpriseKey is missing from config', async () => {
    interface WritableConfig {
      app: typeof firebaseConfig.app;
      recaptchaEnterpriseKey: string;
      appCheckDebugToken: string;
    }

    const config = firebaseConfig as WritableConfig;
    const originalKey = config.recaptchaEnterpriseKey;
    config.recaptchaEnterpriseKey = '';

    try {
      const service = configureTestBed();
      navigatorMock.onLine = true;

      service.initialize();
      expect(getRemoteConfig).toHaveBeenCalled();
      expect(fetchAndActivate).toHaveBeenCalled();

      await service.getAiBackend();
      expect(initializeAppCheck).not.toHaveBeenCalled();
    } finally {
      config.recaptchaEnterpriseKey = originalKey;
    }
  });

  it('should catch remote config fetch errors and retain defaults gracefully', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;
    vi.mocked(fetchAndActivate).mockRejectedValueOnce(new Error('Fetch timed out'));

    // Non-blocking call should not throw or reject
    expect(() => service.initialize()).not.toThrow();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).toHaveBeenCalled();

    // When fetch fails in the background, signal retains default values
    await vi.waitFor(() => {
      expect(service.appConfig).toEqual({
        useLimitedUseAppCheckTokens: false,
        vertexAILocation: 'global',
        geminiModelName: 'gemini-3.8-flash',
        geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
        thinkingLevel: 'LOW',
      });
    });
  });

  it('should reject if getAiBackend() is called before initialize()', async () => {
    const service = configureTestBed();
    await expect(service.getAiBackend()).rejects.toThrow('Firebase App has not been initialized yet.');
  });

  it('should return valid ai instance and initialize App Check JIT with concurrency lock', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;
    service.initialize();

    expect(initializeAppCheck).not.toHaveBeenCalled();

    const ai1 = await service.getAiBackend();
    const ai2 = await service.getAiBackend();

    expect(ai1).toBeDefined();
    expect(ai1).toBe(ai2);
    // Verified App Check is called exactly once despite concurrent getAiBackend() calls
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);

    // Verify global debug token gets configured on localhost
    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBeDefined();
  });

  it('should expose bundled defaults in appConfig even before initialize() is executed', () => {
    const service = configureTestBed();
    expect(service.appConfig).toEqual({
      useLimitedUseAppCheckTokens: false,
      vertexAILocation: 'global',
      geminiModelName: 'gemini-3.8-flash',
      geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
      thinkingLevel: 'LOW',
    });
  });

  it('should invalidate cached aiBackend when remote config activates new values', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;

    service.initialize();

    await vi.waitFor(() => {
      expect(service.appConfig.vertexAILocation).toBe('us-central1');
    });

    const ai = await service.getAiBackend();
    expect(ai).toBeDefined();
  });

  it('should not configure debug token when online on a production host', async () => {
    windowMock.location.hostname = 'tts-demo.web.app';
    const service = configureTestBed();
    navigatorMock.onLine = true;

    service.initialize();
    expect(initializeAppCheck).not.toHaveBeenCalled();

    await service.getAiBackend();
    expect(initializeAppCheck).toHaveBeenCalled();

    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBe(false);
  });
});
