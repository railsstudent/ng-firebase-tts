import { constructBlobURL, revokeBlobURL } from './blob.util';
import { vi } from 'vitest';

describe('blob.util', () => {
  let createObjectURLSpy: (blob: Blob) => string;
  let revokeObjectURLSpy: (url: string) => void;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:http://localhost/fake-audio-url');
    revokeObjectURLSpy = vi.fn(() => {
      /* No-op mock */
    });

    // Store original static methods
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    // Patch static methods without triggering any 'any' linter warnings
    const urlClass = URL as unknown as {
      createObjectURL: (blob: Blob) => string;
      revokeObjectURL: (url: string) => void;
    };
    urlClass.createObjectURL = createObjectURLSpy;
    urlClass.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    // Restore original static methods
    const urlClass = URL as unknown as {
      createObjectURL: typeof URL.createObjectURL;
      revokeObjectURL: typeof URL.revokeObjectURL;
    };
    urlClass.createObjectURL = originalCreateObjectURL;
    urlClass.revokeObjectURL = originalRevokeObjectURL;
  });

  it('Case 1.1: should construct a valid Object URL from Blob parts', () => {
    const parts = ['mock-audio-frame-1', 'mock-audio-frame-2'];
    const result = constructBlobURL(parts);

    expect(result).toBe('blob:http://localhost/fake-audio-url');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('Case 1.2: should revoke a valid blob URL', () => {
    const validBlobUrl = 'blob:http://localhost/some-audio-blob';
    revokeBlobURL(validBlobUrl);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(validBlobUrl);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('Case 1.3: should not revoke an invalid non-blob URL or undefined', () => {
    revokeBlobURL('http://google.com');
    revokeBlobURL(undefined);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('Case 1.4: should construct a valid Object URL from an empty array of parts', () => {
    const result = constructBlobURL([]);

    expect(result).toBe('blob:http://localhost/fake-audio-url');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });
});
