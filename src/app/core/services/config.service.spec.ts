import { NAVIGATOR, WINDOW } from '@/core/constants/navigator.const';
import '@angular/compiler';
import { Service } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

// Mock firebase/remote-config
vi.mock('firebase/remote-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/remote-config')>();
  return Object.assign({}, actual, {
    getValue: (rc: unknown, key: string) => ({
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

// Create a test subclass of ConfigService to easily intercept read-only ESM static methods
@Service({ autoProvided: false })
class TestConfigService extends ConfigService {
  public mockApp = {};
  public mockAppCheck = {};
  public mockRemoteConfig = {
    settings: {},
  };

  public initializeFirebaseAppCalled = false;
  public initializeAppCheckInstanceCalled = false;
  public setupRemoteConfigCalled = false;
  public fetchRemoteConfigCalled = false;
  public fetchRemoteConfigSucceeds = true;

  protected override initializeFirebaseApp(): unknown {
    this.initializeFirebaseAppCalled = true;
    return this.mockApp;
  }

  protected override initializeAppCheckInstance(): unknown {
    this.initializeAppCheckInstanceCalled = true;
    return this.mockAppCheck;
  }

  protected override setupRemoteConfig(
    app: Parameters<ConfigService['setupRemoteConfig']>[0],
  ): ReturnType<ConfigService['setupRemoteConfig']> {
    this.setupRemoteConfigCalled = !!app;
    return this.mockRemoteConfig as unknown as ReturnType<ConfigService['setupRemoteConfig']>;
  }

  protected override fetchRemoteConfig(): ReturnType<ConfigService['fetchRemoteConfig']> {
    this.fetchRemoteConfigCalled = true;
    if (this.fetchRemoteConfigSucceeds) {
      return Promise.resolve(true) as unknown as ReturnType<ConfigService['fetchRemoteConfig']>;
    } else {
      return Promise.reject(new Error('Fetch timed out'));
    }
  }
}

import firebaseConfig from '@/public/firebase.config.json';

describe('ConfigService', () => {
  let navigatorMock: { onLine: boolean };
  let windowMock: { location: { hostname: string } };

  beforeEach(() => {
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

  function configureTestBed(): TestConfigService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TestConfigService,
        { provide: NAVIGATOR, useValue: navigatorMock },
        { provide: WINDOW, useValue: windowMock },
      ],
    });
    return TestBed.inject(TestConfigService);
  }

  it('should initialize app, setup remote-config, and fetch when online', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;

    await service.initialize();

    expect(service.initializeFirebaseAppCalled).toBe(true);
    expect(service.initializeAppCheckInstanceCalled).toBe(true);
    expect(service.setupRemoteConfigCalled).toBe(true);
    expect(service.fetchRemoteConfigCalled).toBe(true);

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

    expect(service.initializeFirebaseAppCalled).toBe(true);
    expect(service.initializeAppCheckInstanceCalled).toBe(false);
    expect(service.setupRemoteConfigCalled).toBe(true);
    expect(service.fetchRemoteConfigCalled).toBe(false);

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

      expect(service.initializeAppCheckInstanceCalled).toBe(false);
      expect(service.setupRemoteConfigCalled).toBe(true);
      expect(service.fetchRemoteConfigCalled).toBe(true);
    } finally {
      config.recaptchaEnterpriseKey = originalKey;
    }
  });

  it('should catch remote config fetch errors and use defaults gracefully', async () => {
    const service = configureTestBed();
    navigatorMock.onLine = true;
    service.fetchRemoteConfigSucceeds = false;

    // This should resolve cleanly and print a warning rather than crashing
    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.initializeFirebaseAppCalled).toBe(true);
    expect(service.setupRemoteConfigCalled).toBe(true);
    expect(service.fetchRemoteConfigCalled).toBe(true);

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
