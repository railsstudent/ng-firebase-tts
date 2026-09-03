import { TestBed } from '@angular/core/testing';
import { AssetRegistry } from './asset-registry.service';

describe('AssetRegistry', () => {
  let service: AssetRegistry;
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((file: Blob | MediaSource) => {
      const size = 'size' in file ? file.size : 0;
      return `blob:http://localhost/${size}`;
    });
    revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [AssetRegistry],
    });

    service = TestBed.inject(AssetRegistry);
  });

  afterEach(() => {
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.file()).toBeUndefined();
    expect(service.previewUrl()).toBeUndefined();
  });

  it('should generate a preview URL when a file is registered', () => {
    const file = new File(['test content'], 'test.png', { type: 'image/png' });
    service.register(file);

    expect(service.file()).toBe(file);
    expect(service.previewUrl()).toBe(`blob:http://localhost/${file.size}`);
    expect(createObjectUrlSpy).toHaveBeenCalledWith(file);
  });

  it('should revoke the previous URL when a new file is registered', () => {
    const file1 = new File(['content 1'], 'test1.png', { type: 'image/png' });
    const file2 = new File(['longer content 2'], 'test2.png', { type: 'image/png' });

    service.register(file1);
    const firstUrl = service.previewUrl();
    expect(firstUrl).toBe(`blob:http://localhost/${file1.size}`);

    service.register(file2);
    expect(service.previewUrl()).toBe(`blob:http://localhost/${file2.size}`);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith(firstUrl!);
  });

  it('should revoke the final active URL on destruction', () => {
    const file = new File(['test content'], 'test.png', { type: 'image/png' });
    service.register(file);
    const activeUrl = service.previewUrl();

    // Destroy the injection context / service
    TestBed.resetTestingModule();

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith(activeUrl!);
  });
});
