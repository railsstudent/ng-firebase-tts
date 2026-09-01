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
    initializeApp: vi.fn().mockReturnValue({ name: '[DEFAULT]' }),
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
vi.mock('firebase/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/ai')>();
  return Object.assign({}, actual, {
    getAI: () => ({}) as unknown as import('firebase/ai').AI,
  });
});

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

  it('should initialize app, setup remote-config, and fetch when online', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;

    await service.initialize();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(initializeAppCheck).toHaveBeenCalled();
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).toHaveBeenCalled();

    // Verify global debug token gets configured (called 1 time)
    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBeDefined();

    // Verify that values fetched online are correctly stored in the appConfig signal
    expect(service.appConfig).toEqual({
      vertexAILocation: 'us-central1',
      useLimitedUseAppCheckTokens: true,
      geminiModelName: 'gemini-1.5-flash',
      thinkingLevel: 'LOW',
      geminiTTSModelName: 'gemini-1.5-flash-tts',
    });
  });

  it('should skip App Check and dynamic remote-config fetching when offline', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = false;

    await service.initialize();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).not.toHaveBeenCalled();

    // Verify global debug token remains unconfigured (called 0 times)
    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBeUndefined();

    // When offline, it should use the default initialized value
    expect(service.appConfig).toEqual({
      useLimitedUseAppCheckTokens: false,
      vertexAILocation: 'global',
      geminiModelName: 'gemini-3.7-flash',
      geminiTTSModelName: '',
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

      await service.initialize();

      expect(initializeAppCheck).not.toHaveBeenCalled();
      expect(getRemoteConfig).toHaveBeenCalled();
      expect(fetchAndActivate).toHaveBeenCalled();
    } finally {
      config.recaptchaEnterpriseKey = originalKey;
    }
  });

  it('should catch remote config fetch errors and use defaults gracefully', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;
    vi.mocked(fetchAndActivate).mockRejectedValueOnce(new Error('Fetch timed out'));

    // This should resolve cleanly and print a warning rather than crashing
    await expect(service.initialize()).resolves.toBeUndefined();

    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig.app);
    expect(getRemoteConfig).toHaveBeenCalled();
    expect(fetchAndActivate).toHaveBeenCalled();

    // When fetch fails, signal remains on default values
    expect(service.appConfig).toEqual({
      useLimitedUseAppCheckTokens: false,
      vertexAILocation: 'global',
      geminiModelName: 'gemini-3.7-flash',
      geminiTTSModelName: '',
      thinkingLevel: 'LOW',
    });
  });
});
