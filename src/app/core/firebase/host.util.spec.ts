import { isLocalhost } from './host.util';

describe('isLocalhost', () => {
  function createMockWindow(hostname: string): Window {
    return {
      location: { hostname },
    } as unknown as Window;
  }

  it('should return true for localhost', () => {
    const win = createMockWindow('localhost');
    expect(isLocalhost(win)).toBe(true);
  });

  it('should return true for IPv4 loopback 127.0.0.1', () => {
    const win = createMockWindow('127.0.0.1');
    expect(isLocalhost(win)).toBe(true);
  });

  it('should return true for IPv6 loopback ::1', () => {
    const win = createMockWindow('::1');
    expect(isLocalhost(win)).toBe(true);
  });

  it('should return true for IPv6 bracketed loopback [::1]', () => {
    const win = createMockWindow('[::1]');
    expect(isLocalhost(win)).toBe(true);
  });

  it('should return false for non-local production domains', () => {
    expect(isLocalhost(createMockWindow('tts-demo.web.app'))).toBe(false);
    expect(isLocalhost(createMockWindow('example.com'))).toBe(false);
    expect(isLocalhost(createMockWindow('localhost.example.com'))).toBe(false);
  });

  it('should return false when window is null', () => {
    expect(isLocalhost(null)).toBe(false);
  });

  it('should return false when window is undefined', () => {
    expect(isLocalhost(undefined)).toBe(false);
    expect(isLocalhost()).toBe(false);
  });

  it('should return false when hostname is empty or location is missing', () => {
    expect(isLocalhost(createMockWindow(''))).toBe(false);
    expect(isLocalhost({} as Window)).toBe(false);
  });
});
