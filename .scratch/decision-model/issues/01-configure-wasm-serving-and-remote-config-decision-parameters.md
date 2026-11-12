# 01: Configure Local `/wasm` Asset Serving and Remote Config Decision Parameters (`ConfigService`)

**What to build:**
Configure the Angular build pipeline and Service Worker **Asset Cache Manifest** to serve `@mediapipe/tasks-decision` WebAssembly runtime files locally from `/wasm` with lazy caching (adding 0 bytes to the initial startup bundle), and expose `decisionModelPath` and `decisionConfidenceThreshold` (`0.4`) in **Remote Config Defaults**, the Firebase Remote Config template, `AppRemoteConfig`, `ConfigService`, and test mock factories.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Target Files

- `angular.json`
- `ngsw-config.json`
- `public/remote-config-defaults.json`
- `firebase/remote-config-template.json`
- `src/app/core/firebase/app-remote-config.interface.ts`
- `src/app/core/firebase/config.service.ts`
- `src/testing/config.mock.ts`
- `src/testing/firebase.mock.ts`
- `src/app/core/firebase/config.service.spec.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Ensure `node_modules` Dependencies Are Installed

- [ ] If `node_modules/@mediapipe/tasks-decision` is not yet unpacked on disk, run `npm install` (which populates `node_modules/@mediapipe/tasks-decision` from the existing `package.json` and `package-lock.json` entries).

### 2. Map `/wasm` Assets in `angular.json` and Lazy-Cache in `ngsw-config.json`

- [ ] Update `projects.ng-firebase-tts.architect.build.options.assets` in `angular.json` to copy `node_modules/@mediapipe/tasks-decision/wasm` to `/wasm`:

  ```json
  "assets": [
    {
      "glob": "**/*",
      "input": "public"
    },
    {
      "glob": "**/*",
      "input": "public/.well-known",
      "output": "/.well-known"
    },
    {
      "glob": "**/*",
      "input": "node_modules/@mediapipe/tasks-decision/wasm",
      "output": "/wasm"
    }
  ],
  ```

- [ ] Update the `assets` (`"installMode": "lazy"`) group in `ngsw-config.json` to include `"/wasm/**"`:

  ```json
  {
    "name": "assets",
    "installMode": "lazy",
    "updateMode": "prefetch",
    "resources": {
      "files": [
        "/assets/**",
        "/icons/**",
        "/images/**",
        "/wasm/**",
        "/**/*.woff2",
        "/**/*.woff",
        "/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf)"
      ],
      "urls": ["https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**"]
    }
  }
  ```

### 3. Add `decisionModelPath` and `decisionConfidenceThreshold` to Remote Config Files

- [ ] Update `public/remote-config-defaults.json`:

  ```json
  {
    "useLimitedUseAppCheckTokens": "true",
    "functionEmulatorHost": "localhost",
    "functionEmulatorPort": "5001",
    "vertexAILocation": "global",
    "geminiTTSModelName": "gemini-3.1-flash-tts-preview",
    "thinkingLevel": "LOW",
    "functionRegion": "asia-east2",
    "geminiModelName": "gemini-3.8-flash",
    "decisionModelPath": "https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm",
    "decisionConfidenceThreshold": "0.4"
  }
  ```

- [ ] Add `decisionModelPath` and `decisionConfidenceThreshold` under `parameters` in `firebase/remote-config-template.json`:

  ```json
  "decisionModelPath": {
    "defaultValue": {
      "value": "https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm"
    },
    "description": "LiteRT-LM model URL for MediaPipe DecisionMaker on-device image classification",
    "valueType": "STRING"
  },
  "decisionConfidenceThreshold": {
    "defaultValue": {
      "value": "0.4"
    },
    "description": "Minimum confidence threshold required to accept on-device image classification before falling back to general",
    "valueType": "NUMBER"
  }
  ```

### 4. Update `AppRemoteConfig` and `ConfigService`

- [ ] Update `src/app/core/firebase/app-remote-config.interface.ts`:

  ```ts
  import type { ThinkingLevel } from 'firebase/ai';

  export interface AppRemoteConfig {
    vertexAILocation: string;
    geminiModelName: string;
    geminiTTSModelName: string;
    thinkingLevel: ThinkingLevel;
    useLimitedUseAppCheckTokens: boolean;
    decisionModelPath: string;
    decisionConfidenceThreshold: number;
  }
  ```

- [ ] Update `#appConfig` initialization and `fetchRemoteConfig` in `src/app/core/firebase/config.service.ts`:

  ```ts
  #appConfig: AppRemoteConfig = {
    useLimitedUseAppCheckTokens: remoteConfigDefaults.useLimitedUseAppCheckTokens === 'true',
    vertexAILocation: remoteConfigDefaults.vertexAILocation,
    geminiModelName: remoteConfigDefaults.geminiModelName,
    geminiTTSModelName: remoteConfigDefaults.geminiTTSModelName,
    thinkingLevel: remoteConfigDefaults.thinkingLevel as ThinkingLevel,
    decisionModelPath: remoteConfigDefaults.decisionModelPath,
    decisionConfidenceThreshold: Number(remoteConfigDefaults.decisionConfidenceThreshold),
  };
  ```

  And inside `fetchRemoteConfig`:

  ```ts
  fetchAndActivate(rc).then(() => {
    this.#appConfig = {
      vertexAILocation: getValue(rc, 'vertexAILocation').asString(),
      useLimitedUseAppCheckTokens: getValue(rc, 'useLimitedUseAppCheckTokens').asBoolean(),
      geminiModelName: getValue(rc, 'geminiModelName').asString(),
      thinkingLevel: getValue(rc, 'thinkingLevel').asString() as ThinkingLevel,
      geminiTTSModelName: getValue(rc, 'geminiTTSModelName').asString(),
      decisionModelPath: getValue(rc, 'decisionModelPath').asString(),
      decisionConfidenceThreshold: getValue(rc, 'decisionConfidenceThreshold').asNumber(),
    };
    this.#ai = null;
  });
  ```

### 5. Update Test Mocks and `config.service.spec.ts`

- [ ] Update `createMockAppRemoteConfig` in `src/testing/config.mock.ts`:

  ```ts
  export function createMockAppRemoteConfig(overrides?: Partial<AppRemoteConfig>): AppRemoteConfig {
    return {
      vertexAILocation: 'us-central1',
      geminiModelName: 'gemini-2.5-flash',
      geminiTTSModelName: 'gemini-2.0-flash-exp',
      thinkingLevel: ThinkingLevel.LOW,
      useLimitedUseAppCheckTokens: true,
      decisionModelPath:
        'https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm',
      decisionConfidenceThreshold: 0.4,
      ...(overrides ?? {}),
    };
  }
  ```

- [ ] Update `resolveRemoteConfigString` and `createRemoteConfigMocks` in `src/testing/firebase.mock.ts`:

  ```ts
  function resolveRemoteConfigString(key: string): string {
    switch (key) {
      case 'vertexAILocation':
        return 'us-central1';
      case 'geminiModelName':
        return 'gemini-1.5-flash';
      case 'geminiTTSModelName':
        return 'gemini-1.5-flash-tts';
      case 'thinkingLevel':
        return 'LOW';
      case 'decisionModelPath':
        return 'https://example.com/models/embeddinggemma-2.litertlm';
      default:
        return '';
    }
  }
  ```

  And in `createRemoteConfigMocks`:

  ```ts
  getValue: vi.fn((_rc: unknown, key: string) => ({
    asString: () => resolveRemoteConfigString(key),
    asBoolean: () => key === 'useLimitedUseAppCheckTokens',
    asNumber: () => (key === 'decisionConfidenceThreshold' ? 0.4 : 0),
  })),
  ```

- [ ] Update assertions in `src/app/core/firebase/config.service.spec.ts` for bundled defaults and fetched Remote Config values to include `decisionModelPath` and `decisionConfidenceThreshold: 0.4` (Red -> Green TDD loop):

  ```ts
  // 1. Inside 'should initialize app, setup remote-config, and fetch in background when online':
  await vi.waitFor(() => {
    expect(service.appConfig).toEqual({
      vertexAILocation: 'us-central1',
      useLimitedUseAppCheckTokens: true,
      geminiModelName: 'gemini-1.5-flash',
      thinkingLevel: 'LOW',
      geminiTTSModelName: 'gemini-1.5-flash-tts',
      decisionModelPath: 'https://example.com/models/embeddinggemma-2.litertlm',
      decisionConfidenceThreshold: 0.4,
    });
  });

  // 2. Inside 'should skip App Check and dynamic remote-config fetching when offline':
  expect(service.appConfig).toEqual({
    useLimitedUseAppCheckTokens: true,
    vertexAILocation: 'global',
    geminiModelName: 'gemini-3.8-flash',
    geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
    thinkingLevel: 'LOW',
    decisionModelPath:
      'https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm',
    decisionConfidenceThreshold: 0.4,
  });

  // 3. Inside 'should catch remote config fetch errors and retain defaults gracefully':
  await vi.waitFor(() => {
    expect(service.appConfig).toEqual({
      useLimitedUseAppCheckTokens: true,
      vertexAILocation: 'global',
      geminiModelName: 'gemini-3.8-flash',
      geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
      thinkingLevel: 'LOW',
      decisionModelPath:
        'https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm',
      decisionConfidenceThreshold: 0.4,
    });
  });

  // 4. Inside 'should expose bundled defaults in appConfig even before initialize() is executed':
  expect(service.appConfig).toEqual({
    useLimitedUseAppCheckTokens: true,
    vertexAILocation: 'global',
    geminiModelName: 'gemini-3.8-flash',
    geminiTTSModelName: 'gemini-3.1-flash-tts-preview',
    thinkingLevel: 'LOW',
    decisionModelPath:
      'https://huggingface.co/litert-community/embeddinggemma-2-text-vision-440m-litert-lm/resolve/main/embeddinggemma-2-text-vision-440m.litertlm',
    decisionConfidenceThreshold: 0.4,
  });
  ```

### 6. Verification

- [ ] Run targeted unit tests and build verification:

  ```bash
  npm run test:spec src/app/core/firebase/config.service.spec.ts
  npm run build
  ```
