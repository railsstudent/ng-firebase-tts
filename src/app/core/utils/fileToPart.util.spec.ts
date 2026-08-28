import { fileToGenerativePart } from './fileToPart.util';
import { vi } from 'vitest';

describe('fileToPart.util', () => {
  it('Case 3.1: should successfully convert a real File into a base64 inline generative part', async () => {
    // Construct a real File to let Happy-DOM's native FileReader process it
    const fileContent = 'hello-world';
    const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

    const result = await fileToGenerativePart(file);

    expect(result).toEqual({
      inlineData: {
        // 'hello-world' encoded as base64 is 'aGVsbG8td29ybGQ='
        data: 'aGVsbG8td29ybGQ=',
        mimeType: 'text/plain',
      },
    });
  });

  describe('FileReader error paths', () => {
    let originalFileReader: typeof FileReader;

    // We use a shared reference to inspect and trigger callbacks on the created instance
    let activeReaderInstance: MockFileReader | null = null;
    let readPromise: Promise<unknown>;

    class MockFileReader {
      public onloadend: (() => void) | null = null;
      public onerror: ((err: unknown) => void) | null = null;
      public result: string | null = null;

      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        activeReaderInstance = this;
      }

      readAsDataURL(): void {
        // Manual trigger inside the tests
      }
    }

    function triggerOnloadend(resultValue: string | null): void {
      if (activeReaderInstance) {
        activeReaderInstance.result = resultValue;
        if (activeReaderInstance.onloadend) {
          activeReaderInstance.onloadend();
        }
      }
    }

    beforeEach(() => {
      originalFileReader = globalThis.FileReader;
      activeReaderInstance = null;

      // Stub global FileReader with our mock class
      vi.stubGlobal('FileReader', MockFileReader);

      // Deduped setup for all error paths
      const file = new File([''], 'test.png', { type: 'image/png' });
      readPromise = fileToGenerativePart(file);
    });

    afterEach(() => {
      vi.stubGlobal('FileReader', originalFileReader);
    });

    it('Case 3.2: should reject when native onerror event fires on the FileReader', async () => {
      // Manually trigger the onerror event on the created instance
      const expectedError = new Error('Disk read failure');
      if (activeReaderInstance && activeReaderInstance.onerror) {
        activeReaderInstance.onerror(expectedError);
      }

      await expect(readPromise).rejects.toThrow('Disk read failure');
    });

    it('Case 3.3: should reject when FileReader returns a null result', async () => {
      triggerOnloadend(null);
      await expect(readPromise).rejects.toThrow('FileReader returned null result');
    });

    it('Case 3.4: should reject when FileReader result is not in expected comma-separated base64 format', async () => {
      triggerOnloadend('data:image/png;base64-aGVsbG8=');
      await expect(readPromise).rejects.toThrow('FileReader result is not in expected format');
    });
  });
});
