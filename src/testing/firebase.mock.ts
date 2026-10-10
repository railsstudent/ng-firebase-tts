import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// 1. firebase/app
// ---------------------------------------------------------------------------
function createAppMocks() {
  const mockFirebaseAppInstance = {
    name: '[DEFAULT]',
    options: {
      projectId: 'demo-test-project',
      apiKey: 'test-api-key',
      appId: 'test-app-id',
    },
    container: {
      getProvider: vi.fn().mockReturnValue({
        getImmediate: vi.fn().mockReturnValue({}),
        getComponent: vi.fn().mockReturnValue({}),
        heartbeatController: {
          triggerHeartbeat: vi.fn(),
        },
      }),
    },
  };

  const mockFirebaseApp = {
    initializeApp: vi.fn().mockReturnValue(mockFirebaseAppInstance),
  };

  const mockFirebaseAppCheck = {
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn(),
  };

  return { mockFirebaseAppInstance, mockFirebaseApp, mockFirebaseAppCheck };
}

// ---------------------------------------------------------------------------
// 2. firebase/remote-config
// ---------------------------------------------------------------------------
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
    default:
      return '';
  }
}

function createRemoteConfigMocks() {
  const mockFirebaseRemoteConfig = {
    getRemoteConfig: vi.fn().mockReturnValue({
      defaultConfig: {},
      settings: {},
    }),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn((_rc: unknown, key: string) => ({
      asString: () => resolveRemoteConfigString(key),
      asBoolean: () => key === 'useLimitedUseAppCheckTokens',
      asNumber: () => 0,
    })),
  };

  return { mockFirebaseRemoteConfig };
}

// ---------------------------------------------------------------------------
// 3. firebase/auth
// ---------------------------------------------------------------------------
function createAuthMocks() {
  const mockAuthInstance = {
    name: '[DEFAULT]',
    app: {},
    currentUser: null,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  };

  let defaultAuthStateCallback: ((user: unknown) => void) | null = null;

  const mockFirebaseAuth = {
    getAuth: vi.fn(() => mockAuthInstance),
    connectAuthEmulator: vi.fn(),
    browserSessionPersistence: 'SESSION',
    setPersistence: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: unknown) => void) => {
      defaultAuthStateCallback = callback;
      return vi.fn();
    }),
    authStateReady: vi.fn().mockResolvedValue(undefined),
    signInWithEmailAndPassword: vi.fn().mockImplementation(async () => {
      const user = { uid: 'test-uid-123', email: 'test@example.com' };
      defaultAuthStateCallback?.(user);
      return { user };
    }),
    signOut: vi.fn().mockImplementation(async () => {
      defaultAuthStateCallback?.(null);
      return undefined;
    }),
  };

  return { mockAuthInstance, mockFirebaseAuth };
}

// ---------------------------------------------------------------------------
// 4. firebase/ai & @firebase/ai
// ---------------------------------------------------------------------------
function createVisionAiModel() {
  return {
    generateContent: vi.fn().mockImplementation(async () => ({
      response: {
        text: () => '{"altText":"Test alt text","tags":["tag1"],"suggestions":[],"obscureFact":"Fact"}',
        thoughtSummary: () => 'Analysis thought summary',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, thoughtsTokenCount: 0, totalTokenCount: 20 },
        candidates: [],
      },
    })),
    generateContentStream: vi.fn(),
    startChat: vi.fn(),
  };
}

function createTtsAiModel() {
  return {
    generateContent: vi.fn().mockImplementation(async () => ({
      response: {
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' } }],
            },
          },
        ],
      },
    })),
    generateContentStream: vi.fn().mockImplementation(async () => ({
      stream: (async function* () {
        yield {
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' } }],
              },
            },
          ],
        };
      })(),
    })),
    startChat: vi.fn(),
  };
}

function createAiSchemaMocks() {
  return {
    object: vi.fn((config: unknown) => ({ type: 'OBJECT', ...((config as object) ?? {}) })),
    array: vi.fn((config: unknown) => ({ type: 'ARRAY', ...((config as object) ?? {}) })),
    string: vi.fn(() => ({ type: 'STRING' })),
    integer: vi.fn(() => ({ type: 'INTEGER' })),
    number: vi.fn(() => ({ type: 'NUMBER' })),
    boolean: vi.fn(() => ({ type: 'BOOLEAN' })),
    enum: vi.fn((values: unknown) => ({ type: 'STRING', enum: values })),
  };
}

function createAiBackendMocks() {
  const mockAgentPlatformBackend = vi.fn().mockImplementation(function (location?: unknown) {
    return {
      backendType: 'VERTEX',
      location,
      _getModelPath: vi.fn().mockReturnValue('projects/demo/models/mock'),
    };
  });

  const mockGetAI = vi.fn().mockImplementation((app: unknown, options?: { backend?: unknown }) => ({
    backend: options?.backend ?? {
      backendType: 'VERTEX',
      _getModelPath: vi.fn().mockReturnValue('projects/demo/models/mock'),
    },
    backendType: 'VERTEX',
    app: app ?? {
      options: { projectId: 'demo-test-project' },
    },
  }));

  return { mockAgentPlatformBackend, mockGetAI };
}

function createAiEnums() {
  return {
    SchemaType: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT',
    },
    ThinkingLevel: { LOW: 'LOW', HIGH: 'HIGH' },
    HarmCategory: {
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    },
    HarmBlockThreshold: {
      BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
      BLOCK_NONE: 'BLOCK_NONE',
      BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    },
    ResponseModality: {
      AUDIO: 'AUDIO',
      TEXT: 'TEXT',
      IMAGE: 'IMAGE',
    },
  };
}

function createAiMocks() {
  const mockAiModel = createVisionAiModel();
  const mockTtsAiModel = createTtsAiModel();
  const mockSchema = createAiSchemaMocks();
  const { mockAgentPlatformBackend, mockGetAI } = createAiBackendMocks();
  const aiEnums = createAiEnums();

  const mockGetGenerativeModel = vi
    .fn()
    .mockImplementation((_ai?: unknown, options?: { generationConfig?: { responseModalities?: unknown[] } }) => {
      if (options?.generationConfig?.responseModalities?.length) {
        return mockTtsAiModel;
      }
      return mockAiModel;
    });

  const mockFirebaseAi = {
    getAI: mockGetAI,
    AgentPlatformBackend: mockAgentPlatformBackend,
    GoogleAIBackend: vi.fn(),
    VertexAIBackend: mockAgentPlatformBackend,
    BackendType: { VERTEX: 'VERTEX', GOOGLE_AI: 'GOOGLE_AI' },
    GenerativeModel: vi.fn().mockImplementation(() => mockAiModel),
    getGenerativeModel: mockGetGenerativeModel,
    getLiveGenerativeModel: mockGetGenerativeModel,
    getTemplateGenerativeModel: mockGetGenerativeModel,
    Schema: mockSchema,
    ...aiEnums,
  };

  return {
    mockAiModel,
    mockTtsAiModel,
    mockGetGenerativeModel,
    mockSchema,
    mockAgentPlatformBackend,
    mockGetAI,
    mockFirebaseAi,
  };
}

function initializeFirebaseMocks() {
  const appMocks = createAppMocks();
  const remoteConfigMocks = createRemoteConfigMocks();
  const authMocks = createAuthMocks();
  const aiMocks = createAiMocks();

  return {
    ...appMocks,
    ...remoteConfigMocks,
    ...authMocks,
    ...aiMocks,
  };
}

// ---------------------------------------------------------------------------
// Worker-level Singleton State
// ---------------------------------------------------------------------------
interface GlobalMockHolder {
  __FIREBASE_MOCK_STATE__?: ReturnType<typeof initializeFirebaseMocks>;
}

const globalMockHolder = globalThis as unknown as GlobalMockHolder;
const state = (globalMockHolder.__FIREBASE_MOCK_STATE__ ??= initializeFirebaseMocks());

export const mockFirebaseAppInstance = state.mockFirebaseAppInstance;
export const mockFirebaseApp = state.mockFirebaseApp;
export const mockFirebaseAppCheck = state.mockFirebaseAppCheck;
export const mockFirebaseRemoteConfig = state.mockFirebaseRemoteConfig;
export const mockAuthInstance = state.mockAuthInstance;
export const mockFirebaseAuth = state.mockFirebaseAuth;
export const mockAiModel = state.mockAiModel;
export const mockTtsAiModel = state.mockTtsAiModel;
export const mockGetGenerativeModel = state.mockGetGenerativeModel;
export const mockSchema = state.mockSchema;
export const mockAgentPlatformBackend = state.mockAgentPlatformBackend;
export const mockGetAI = state.mockGetAI;
export const mockFirebaseAi = state.mockFirebaseAi;

// ---------------------------------------------------------------------------
// Global Module Mock Registrations
// ---------------------------------------------------------------------------
vi.mock('firebase/app', () => state.mockFirebaseApp);
vi.mock('firebase/app-check', () => state.mockFirebaseAppCheck);
vi.mock('firebase/remote-config', () => state.mockFirebaseRemoteConfig);
vi.mock('firebase/auth', () => state.mockFirebaseAuth);
vi.mock('firebase/ai', () => state.mockFirebaseAi);
vi.mock('@firebase/ai', () => state.mockFirebaseAi);
