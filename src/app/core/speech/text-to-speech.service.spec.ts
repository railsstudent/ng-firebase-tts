import { ConfigService } from '@/core/services/config.service';
import { createTtsResponseMock, createTtsStreamMock, getMockTtsModel } from '@/testing/ai-model.mock';
import { createMockConfigService } from '@/testing/config.mock';
import { TestBed } from '@angular/core/testing';
import { TextToSpeechService } from './text-to-speech.service';

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let mockModel: ReturnType<typeof getMockTtsModel>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let appConfigSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockModel = getMockTtsModel();
    mockModel.generateContent.mockReset();
    mockModel.generateContent.mockResolvedValue(createTtsResponseMock());

    mockModel.generateContentStream.mockReset();
    mockModel.generateContentStream.mockResolvedValue(createTtsStreamMock());

    mockConfigService = createMockConfigService();
    appConfigSpy = vi.spyOn(mockConfigService, 'appConfig', 'get');

    TestBed.configureTestingModule({
      providers: [TextToSpeechService, { provide: ConfigService, useValue: mockConfigService }],
    });

    service = TestBed.inject(TextToSpeechService);
  });

  describe('On-demand Model Construction', () => {
    it('should read modelName from ConfigService appConfig dynamically on demand during synthesis', async () => {
      appConfigSpy.mockClear();

      let testService!: TextToSpeechService;
      TestBed.runInInjectionContext(() => {
        testService = new TextToSpeechService();
      });

      // Does not access appConfig during constructor instantiation
      expect(appConfigSpy).not.toHaveBeenCalled();

      // Mock generative response
      mockModel.generateContent.mockResolvedValue(createTtsResponseMock());

      // Call public methods
      await testService.synthesize({ text: 'Test 1', voice: 'Kore' });
      expect(appConfigSpy).toHaveBeenCalledTimes(1);

      await testService.synthesize({ text: 'Test 2', voice: 'Puck' });
      expect(appConfigSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('synthesize (Use Case 1 - Ad-hoc Single-shot)', () => {
    it('should fetch complete content, decode base64, create a blob and return Object URL', async () => {
      const mockBase64 = 'SGVsbG8=';
      mockModel.generateContent.mockResolvedValue(createTtsResponseMock({ base64Data: mockBase64 }));
      const blob = await service.synthesize({ text: 'Hello Fact', voice: 'Kore' });

      expect(mockModel.generateContent).toHaveBeenCalledWith(['Hello Fact']);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('should throw an error if generateContent returns empty candidates or data', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {},
      });

      await expect(service.synthesize({ text: 'Empty Fact', voice: 'Puck' })).rejects.toThrow(
        'No audio data received in response.',
      );
    });
  });

  describe('synthesizeStream (Use Case 2 - Streamed Synthesis)', () => {
    it('should stream chunks and yield pure AudioStreamChunk objects', async () => {
      mockModel.generateContentStream.mockResolvedValue(
        createTtsStreamMock([
          { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' },
          { data: 'V29ybGQ=', mimeType: 'audio/l16; rate=24000; channels=1' },
        ]),
      );

      const generator = service.synthesizeStream({ text: 'Dynamic Stream', voice: 'Kore' });
      const emissions = [];
      for await (const chunk of generator) {
        emissions.push(chunk);
      }

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(['Dynamic Stream']);
      expect(emissions.length).toBe(2);
      expect(emissions[0]).toEqual({
        decodedData: expect.any(Uint8Array),
        sampleRate: 24000,
        mimeType: 'audio/l16; rate=24000; channels=1',
      });
      expect(emissions[1]).toEqual({
        decodedData: expect.any(Uint8Array),
        sampleRate: 24000,
        mimeType: 'audio/l16; rate=24000; channels=1',
      });
    });

    it('should rethrow on stream errors', async () => {
      mockModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

      const generator = service.synthesizeStream({ text: 'Failing stream', voice: 'Puck' });
      await expect(generator.next()).rejects.toThrow('Vertex AI stream error');
    });
  });
});
