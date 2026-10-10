import { formatAcceptedFormats } from './photo-picker.util';

describe('photo-picker.util', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatAcceptedFormats', () => {
    it('should format MIME types into a human-readable list', () => {
      const types = ['image/jpeg', 'image/png', 'image/webp'] as const;
      expect(formatAcceptedFormats(types)).toBe('JPEG, PNG, or WEBP');
    });

    it('should deduplicate jpeg and jpg MIME aliases into a single label', () => {
      const types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
      expect(formatAcceptedFormats(types)).toBe('JPEG, PNG, or WEBP');
    });

    it('should handle single format or empty array safely', () => {
      expect(formatAcceptedFormats(['image/png'])).toBe('PNG');
      expect(formatAcceptedFormats([])).toBe('');
    });
  });
});
