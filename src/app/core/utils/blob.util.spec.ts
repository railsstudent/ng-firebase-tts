import { revokeBlobURL } from '@/core/utils/blob.util';
import { vi } from 'vitest';

describe('blob.util', () => {
  let revokeObjectURLSpy: (url: string) => void;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    revokeObjectURLSpy = vi.fn(() => {
      /* No-op mock */
    });

    originalRevokeObjectURL = URL.revokeObjectURL;

    const urlClass = URL as unknown as {
      revokeObjectURL: (url: string) => void;
    };
    urlClass.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    const urlClass = URL as unknown as {
      revokeObjectURL: typeof URL.revokeObjectURL;
    };
    urlClass.revokeObjectURL = originalRevokeObjectURL;
  });

  it('Case 1.1: should revoke a valid blob URL', () => {
    const validBlobUrl = 'blob:http://localhost/some-audio-blob';
    revokeBlobURL(validBlobUrl);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(validBlobUrl);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('Case 1.2: should not revoke an invalid non-blob URL or undefined', () => {
    revokeBlobURL('http://google.com');
    revokeBlobURL(undefined);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });
});
