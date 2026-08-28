import { configureAppCheckDebugToken } from './platform.util';

describe('configureAppCheckDebugToken', () => {
  beforeEach(() => {
    const globalObj = globalThis as Record<string, unknown>;
    globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN'] = undefined;
  });

  it('Scenario 1: should set explicit token string when configToken is provided and running locally', () => {
    // configToken, isLocalhost, isDevContext
    configureAppCheckDebugToken('my-custom-token', true, true);

    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBe('my-custom-token');
  });

  it('Scenario 2: should fallback to true when configToken is missing but running locally', () => {
    configureAppCheckDebugToken(undefined, true, true);

    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBe(true);
  });

  it('Scenario 3: should force false when in production (isDevContext is false) and not on localhost', () => {
    // Simulate production environment (isDevContext = false, isLocalhost = false)
    configureAppCheckDebugToken('accidental-leak-token', false, false);

    // STRICT PROTECTION: The token must be completely ignored and set to false
    const globalObj = globalThis as Record<string, unknown>;
    expect(globalObj['FIREBASE_APPCHECK_DEBUG_TOKEN']).toBe(false);
  });
});
