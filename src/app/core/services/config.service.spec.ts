import '@angular/compiler';
import { NAVIGATOR, WINDOW } from '@/core/constants/navigator.const';
import { Service } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from 'firebase/app';
import { AppCheck } from 'firebase/app-check';
import { RemoteConfig } from 'firebase/remote-config';
import { ConfigService } from './config.service';

// Create a test subclass of ConfigService to easily intercept read-only ESM static methods
@Service({ autoProvided: false })
class TestConfigService extends ConfigService {
  public mockApp = {} as FirebaseApp;
  public mockAppCheck = {} as AppCheck;
  public mockRemoteConfig = {
    settings: {},
  } as unknown as RemoteConfig;

  public initializeFirebaseAppCalled = false;
  public initializeAppCheckInstanceCalled = false;
  public setupRemoteConfigCalled = false;
  public fetchRemoteConfigCalled = false;
  public fetchRemoteConfigSucceeds = true;

  protected override initializeFirebaseApp(): FirebaseApp {
    this.initializeFirebaseAppCalled = true;
    return this.mockApp;
  }

  protected override initializeAppCheckInstance(): AppCheck {
    this.initializeAppCheckInstanceCalled = true;
    return this.mockAppCheck;
  }

  protected override setupRemoteConfig(app: FirebaseApp): RemoteConfig {
    this.setupRemoteConfigCalled = !!app;
    return this.mockRemoteConfig;
  }

  protected override fetchRemoteConfig(): Promise<boolean> {
    this.fetchRemoteConfigCalled = true;
    if (this.fetchRemoteConfigSucceeds) {
      return Promise.resolve(true);
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

  it('should throw an error when accessing firebaseApp before initialization', () => {
    const service = configureTestBed();
    expect(() => service.firebaseApp).toThrow('Firebase app has not been initialized yet.');
  });

  it('should throw an error when accessing remoteConfig before initialization', () => {
    const service = configureTestBed();
    expect(() => service.remoteConfig).toThrow(
      'Firebase remote config has not been initialized yet.',
    );
  });

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

    expect(service.firebaseApp).toBe(service.mockApp);
    expect(service.remoteConfig).toBe(service.mockRemoteConfig);
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

    expect(service.firebaseApp).toBe(service.mockApp);
    expect(service.remoteConfig).toBe(service.mockRemoteConfig);
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
  });
});
