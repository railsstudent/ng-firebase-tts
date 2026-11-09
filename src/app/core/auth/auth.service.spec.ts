import { AuthService } from './auth.service';
import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/firebase/config.service';
import { createMockConfigService } from '@/testing/config.mock';
import { TestBed } from '@angular/core/testing';
import type { Auth, User } from 'firebase/auth';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

interface EnsureAuthResult {
  auth: Auth;
  sdk: typeof import('firebase/auth');
}

interface AuthServiceWithInternal {
  ensureAuth: () => Promise<EnsureAuthResult>;
}

const mockUnsubscribe = vi.fn();
let authStateCallback: ((user: User | null) => void) | null = null;
let mockAuthInstance: Auth;

describe('AuthService', () => {
  let windowMock: {
    location: { hostname: string };
  } | null = null;

  const mockConfigService = createMockConfigService();

  function resetAuthMocks(): void {
    mockUnsubscribe.mockClear();
    mockConfigService.initialize.mockClear();
    mockConfigService.getAiBackend.mockClear();
    mockConfigService.getApp.mockClear();
    const authMocks = [
      connectAuthEmulator,
      setPersistence,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      getAuth,
    ];
    for (const fn of authMocks) {
      vi.mocked(fn).mockClear();
    }
  }

  function setupAuthEventLoop(): void {
    authStateCallback = null;
    mockAuthInstance = vi.mocked(getAuth)() as unknown as Auth;
    (mockAuthInstance as { emulatorConfig: unknown }).emulatorConfig = null;
    vi.mocked(mockAuthInstance.authStateReady).mockReset().mockResolvedValue(undefined);
    vi.mocked(getAuth).mockClear();

    vi.mocked(onAuthStateChanged).mockImplementation((_auth, nextOrObserver) => {
      authStateCallback = typeof nextOrObserver === 'function' ? nextOrObserver : nextOrObserver.next;
      return mockUnsubscribe;
    });

    vi.mocked(signInWithEmailAndPassword).mockImplementation(async () => {
      const user = { uid: 'test-uid-123', email: 'test@example.com' } as User;
      authStateCallback?.(user);
      return { user } as never;
    });

    vi.mocked(signOut).mockImplementation(async () => {
      authStateCallback?.(null);
      return undefined;
    });
  }

  beforeEach(() => {
    resetAuthMocks();
    setupAuthEventLoop();
    windowMock = {
      location: {
        hostname: 'localhost',
      },
    };
  });

  function configureTestBed(): AuthService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WINDOW, useValue: windowMock },
      ],
    });
    return TestBed.inject(AuthService);
  }

  it('should be created with initial user = null and isAuthenticated = false without loading firebase/auth on cold start', () => {
    const service = configureTestBed();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(getAuth).not.toHaveBeenCalled();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
  });

  it('should dynamically load firebase/auth, set session persistence, await authStateReady, and register onAuthStateChanged listener on ensureAuth()', async () => {
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    await serviceWithAuth.ensureAuth();

    expect(getAuth).toHaveBeenCalled();
    expect(setPersistence).toHaveBeenCalledWith(mockAuthInstance, browserSessionPersistence);
    expect(onAuthStateChanged).toHaveBeenCalledWith(mockAuthInstance, expect.any(Function));
    expect(mockAuthInstance.authStateReady).toHaveBeenCalled();
  });

  it('should connect to Auth Emulator on localhost', async () => {
    if (windowMock) {
      windowMock.location.hostname = 'localhost';
    }
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    await serviceWithAuth.ensureAuth();

    expect(connectAuthEmulator).toHaveBeenCalledWith(mockAuthInstance, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
  });

  it('should not connect to Auth Emulator on production host domain', async () => {
    if (windowMock) {
      windowMock.location.hostname = 'tts-production.web.app';
    }
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    await serviceWithAuth.ensureAuth();

    expect(connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('should update isAuthenticated and user signals reactively when onAuthStateChanged receives user or null', async () => {
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    await serviceWithAuth.ensureAuth();

    expect(authStateCallback).toBeDefined();

    if (authStateCallback) {
      authStateCallback({ uid: 'active-user-123', email: 'active@example.com' } as User);
    }
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.uid).toBe('active-user-123');

    if (authStateCallback) {
      authStateCallback(null);
    }
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('should deduplicate concurrent calls to ensureAuth() and return auth and sdk instance context', async () => {
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    const [context1, context2] = await Promise.all([serviceWithAuth.ensureAuth(), serviceWithAuth.ensureAuth()]);

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(context1.auth).toBe(mockAuthInstance);
    expect(context2.auth).toBe(mockAuthInstance);
    expect(context1.sdk).toBeDefined();
    expect(context2.sdk).toBeDefined();
  });

  it('should handle SSR environment gracefully when WINDOW is null', () => {
    windowMock = null;
    const service = configureTestBed();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('should register onDestroy cleanup callback to unsubscribe auth state listener on destroy', async () => {
    const service = configureTestBed();
    const serviceWithAuth = service as unknown as AuthServiceWithInternal;

    await serviceWithAuth.ensureAuth();
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    TestBed.resetTestingModule();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should support signIn with credentials and update authentication state', async () => {
    const service = configureTestBed();

    await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });

    expect(service.isAuthenticated()).toBe(true);
  });

  it('should reset user to null and not call signInWithEmailAndPassword if email is empty', async () => {
    const service = configureTestBed();

    await service.signIn({ email: '', password: 'ValidPassword123' });

    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should reset user to null and not call signInWithEmailAndPassword if password is empty', async () => {
    const service = configureTestBed();

    await service.signIn({ email: 'user@example.com', password: '' });

    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should reset authentication state when signOut is invoked', async () => {
    const service = configureTestBed();

    await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });
    expect(service.isAuthenticated()).toBe(true);

    await service.signOut();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should share a failed initialization attempt across concurrent callers, clean up partial listener, and succeed on retry with one active listener', async () => {
    const service = configureTestBed();
    const initError = new Error('Network error during authStateReady');
    const failedAttemptUnsubscribe = vi.fn();
    const retryAttemptUnsubscribe = vi.fn();

    vi.mocked(onAuthStateChanged)
      .mockImplementationOnce((_auth, nextOrObserver) => {
        authStateCallback = typeof nextOrObserver === 'function' ? nextOrObserver : nextOrObserver.next;
        return failedAttemptUnsubscribe;
      })
      .mockImplementationOnce((_auth, nextOrObserver) => {
        authStateCallback = typeof nextOrObserver === 'function' ? nextOrObserver : nextOrObserver.next;
        return retryAttemptUnsubscribe;
      });

    vi.mocked(mockAuthInstance.authStateReady).mockRejectedValueOnce(initError).mockResolvedValueOnce(undefined);

    const [firstResult, secondResult] = await Promise.allSettled([
      service.signIn({ email: 'user@example.com', password: 'ValidPassword123' }),
      service.signIn({ email: 'user@example.com', password: 'ValidPassword123' }),
    ]);

    expect(firstResult).toEqual({ status: 'rejected', reason: initError });
    expect(secondResult).toEqual({ status: 'rejected', reason: initError });
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(failedAttemptUnsubscribe).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();

    await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });

    expect(getAuth).toHaveBeenCalledTimes(2);
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(2);
    expect(retryAttemptUnsubscribe).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(true);

    TestBed.resetTestingModule();

    expect(failedAttemptUnsubscribe).toHaveBeenCalledTimes(1);
    expect(retryAttemptUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should keep initialization cached when an ordinary signInWithEmailAndPassword error occurs', async () => {
    const service = configureTestBed();
    const credentialError = new Error('auth/invalid-credential');

    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(credentialError);

    await expect(service.signIn({ email: 'user@example.com', password: 'WrongPassword123' })).rejects.toThrow(
      credentialError,
    );

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);

    await service.signIn({ email: 'user@example.com', password: 'ValidPassword123' });

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2);
    expect(service.isAuthenticated()).toBe(true);
  });
});
