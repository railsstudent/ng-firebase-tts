import { injectOnlineStatus } from '@/core/utils/connection.util';
import { configureAppCheckDebugToken, injectIsLocalhost } from '@/core/utils/platform.util';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { isDevMode, Service } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { fetchAndActivate, getRemoteConfig, RemoteConfig } from 'firebase/remote-config';

const SECONDS = 60;
const MILLISECONDS = 1000;
const ONE_HOUR_IN_MILLISECONDS = SECONDS * SECONDS * MILLISECONDS;

@Service()
export class ConfigService {
  #app: FirebaseApp | undefined = undefined;
  #remoteConfig: RemoteConfig | undefined = undefined;
  #isOnline = injectOnlineStatus();
  #isLocalhost = injectIsLocalhost();

  get firebaseApp(): FirebaseApp {
    if (!this.#app) {
      throw new Error('Firebase app has not been initialized yet.');
    }
    return this.#app;
  }

  get remoteConfig() {
    if (!this.#remoteConfig) {
      throw new Error('Firebase remote config has not been initialized yet.');
    }
    return this.#remoteConfig;
  }

  // Testable helper methods to allow mocking of read-only ESM imports
  protected initializeFirebaseApp(config: FirebaseOptions): FirebaseApp {
    return initializeApp(config);
  }

  protected initializeAppCheckInstance(app: FirebaseApp, key: string): AppCheck {
    return initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true,
    });
  }

  protected setupRemoteConfig(app: FirebaseApp): RemoteConfig {
    const rc = getRemoteConfig(app);
    rc.defaultConfig = remoteConfigDefaults;
    rc.settings.minimumFetchIntervalMillis = isDevMode() ? 0 : ONE_HOUR_IN_MILLISECONDS;
    return rc;
  }

  protected fetchRemoteConfig(rc: RemoteConfig): Promise<boolean> {
    return fetchAndActivate(rc);
  }

  async initialize(): Promise<void> {
    this.#app = this.initializeFirebaseApp(firebaseConfig.app);

    const isOnline = this.#isOnline();
    const isLocalhost = this.#isLocalhost();

    if (isOnline && firebaseConfig.recaptchaEnterpriseKey) {
      configureAppCheckDebugToken(firebaseConfig.appCheckDebugToken, isLocalhost);
      this.initializeAppCheckInstance(this.#app, firebaseConfig.recaptchaEnterpriseKey);
    }

    this.#remoteConfig = this.setupRemoteConfig(this.#app);

    if (isOnline) {
      try {
        const activated = await this.fetchRemoteConfig(this.#remoteConfig);
        console.log('Remote Config initialized. Activated new values:', activated);
      } catch (error) {
        console.warn('Remote Config fetch timed out or failed. Using defaults:', error);
      }
    }
  }
}
