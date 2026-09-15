import { AppRemoteConfig } from '@/core/interfaces/app-remote-config.interface';
import { injectOnlineStatus } from '@/core/utils/connection.util';
import { configureAppCheckDebugToken, injectIsLocalhost } from '@/core/utils/platform.util';
import firebaseConfig from '@/public/firebase.config.json';
import remoteConfigDefaults from '@/public/remote-config-defaults.json';
import { isDevMode, Service } from '@angular/core';
import { AgentPlatformBackend, AI, getAI, ThinkingLevel } from 'firebase/ai';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { fetchAndActivate, getRemoteConfig, getValue, RemoteConfig } from 'firebase/remote-config';

const SECONDS = 60;
const MILLISECONDS = 1000;
const ONE_HOUR_IN_MILLISECONDS = SECONDS * SECONDS * MILLISECONDS;
const DEV_TIMEOUT = 1000;
const PROD_TIMEOUT = 2000;

@Service()
export class ConfigService {
  #app: FirebaseApp | undefined = undefined;
  #isOnline = injectOnlineStatus();
  #isLocalhost = injectIsLocalhost();

  #appConfig: AppRemoteConfig = {
    useLimitedUseAppCheckTokens: remoteConfigDefaults.useLimitedUseAppCheckTokens === 'true',
    vertexAILocation: remoteConfigDefaults.vertexAILocation,
    geminiModelName: remoteConfigDefaults.geminiModelName,
    geminiTTSModelName: remoteConfigDefaults.geminiTTSModelName,
    thinkingLevel: ThinkingLevel[remoteConfigDefaults.thinkingLevel as keyof typeof ThinkingLevel],
  };

  get appConfig(): AppRemoteConfig {
    return this.#appConfig;
  }

  #aiBackend: AI | undefined = undefined;
  get aiBackend(): unknown {
    if (!this.#aiBackend) {
      throw new Error('AI backend has not been initialized yet.');
    }
    return this.#aiBackend;
  }

  initialize() {
    this.#app = initializeApp(firebaseConfig.app);
    const isOnline = this.#isOnline();
    const isLocalhost = this.#isLocalhost();
    const key = firebaseConfig.recaptchaEnterpriseKey;

    if (isOnline && key) {
      this.loadAppCheck(isLocalhost, key);
    }

    const rc = getRemoteConfig(this.#app);
    rc.defaultConfig = remoteConfigDefaults;
    const dev = isDevMode();
    rc.settings.minimumFetchIntervalMillis = dev ? 0 : ONE_HOUR_IN_MILLISECONDS;
    rc.settings.fetchTimeoutMillis = dev ? DEV_TIMEOUT : PROD_TIMEOUT;

    this.#aiBackend = getAI(this.#app, {
      backend: new AgentPlatformBackend(this.#appConfig.vertexAILocation),
      useLimitedUseAppCheckTokens: this.#appConfig.useLimitedUseAppCheckTokens,
    });

    if (isOnline) {
      fetchAndActivate(rc)
        .then((activated) => {
          console.log('Remote Config initialized. Activated new values:', activated);
          this.applyRemoteConfigValues(rc);
        })
        .catch((error) => {
          console.warn('Remote Config fetch timed out or failed. Using defaults:', error);
        });
    }
  }

  private applyRemoteConfigValues(rc: RemoteConfig): void {
    const rawThinkingLevel = getValue(rc, 'thinkingLevel').asString();
    const thinkingLevel = ThinkingLevel[rawThinkingLevel as keyof typeof ThinkingLevel];

    this.#appConfig = {
      vertexAILocation: getValue(rc, 'vertexAILocation').asString(),
      useLimitedUseAppCheckTokens: getValue(rc, 'useLimitedUseAppCheckTokens').asBoolean(),
      geminiModelName: getValue(rc, 'geminiModelName').asString(),
      thinkingLevel,
      geminiTTSModelName: getValue(rc, 'geminiTTSModelName').asString(),
    };

    this.#aiBackend = getAI(this.#app, {
      backend: new AgentPlatformBackend(this.#appConfig.vertexAILocation),
      useLimitedUseAppCheckTokens: this.#appConfig.useLimitedUseAppCheckTokens,
    });
  }

  private loadAppCheck(isLocalhost: boolean, key: string): Promise<void> {
    const appCheck = import('firebase/app-check');
    return appCheck.then((m) => {
      configureAppCheckDebugToken(firebaseConfig.appCheckDebugToken, isLocalhost, isDevMode() && isLocalhost);
      m.initializeAppCheck(this.#app, {
        provider: new m.ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true,
      });
    });
  }
}
