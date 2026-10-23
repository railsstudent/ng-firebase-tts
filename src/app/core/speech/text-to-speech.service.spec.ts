import { AiModelFactory } from '@/core/firebase';
import {
  createMockAiModelFactory,
  createMockTtsModel,
  createMockTtsResponse,
  createMockTtsStream,
  MockAiModelFactory,
} from '@/testing/ai-model.mock';
import { TestBed } from '@angular/core/testing';
import { TextToSpeechService } from './text-to-speech.service';

describe('TextToSpeechService', () => {
  let service: TextToSpeechService;
  let mockAiModel: ReturnType<typeof createMockTtsModel>;
  let mockAiModelFactory: MockAiModelFactory;

  beforeEach(() => {
    mockAiModel = createMockTtsModel();
    mockAiModel.generateContent.mockClear();
    mockAiModel.generateContentStream.mockClear();

    mockAiModelFactory = createMockAiModelFactory({ ttsModel: mockAiModel });

    TestBed.configureTestingModule({
      providers: [
        TextToSpeechService,
        {
          provide: AiModelFactory,
          useValue: mockAiModelFactory,
        },
      ],
    });

    service = TestBed.inject(TextToSpeechService);
  });

  describe('On-demand Model Retrieval', () => {
    it('should retrieve the TTS model from AiModelFactory dynamically on demand during synthesis', async () => {
      mockAiModelFactory.getTtsModel.mockClear();

      let testService!: TextToSpeechService;
      TestBed.runInInjectionContext(() => {
        testService = new TextToSpeechService();
      });

      expect(mockAiModelFactory.getTtsModel).not.toHaveBeenCalled();

      mockAiModel.generateContent.mockResolvedValue(createMockTtsResponse());

      await testService.synthesize({ text: 'Test 1', voice: 'Kore' });
      expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(1);

      await testService.synthesize({ text: 'Test 2', voice: 'Puck' });
      expect(mockAiModelFactory.getTtsModel).toHaveBeenCalledTimes(2);
    });
  });

  describe('synthesize (Use Case 1 - Ad-hoc Single-shot)', () => {
    it('should fetch complete content with speechConfig request, decode base64, and return a WAV Blob', async () => {
      const mockBase64 = 'SGVsbG8=';
      mockAiModel.generateContent.mockResolvedValue(createMockTtsResponse({ base64Data: mockBase64 }));
      const blob = await service.synthesize({ text: 'Hello Fact', voice: 'Kore' });

      expect(mockAiModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Hello Fact' }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
            languageCode: 'en-US',
          },
        },
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    it('should throw an error if generateContent returns empty candidates or data', async () => {
      mockAiModel.generateContent.mockResolvedValue({
        response: {},
      });

      await expect(service.synthesize({ text: 'Empty Fact', voice: 'Puck' })).rejects.toThrow(
        'No audio data received in response.',
      );
    });
  });

  describe('synthesizeStream (Use Case 2 - Streamed Synthesis)', () => {
    it('should stream chunks with speechConfig request and yield pure AudioStreamChunk objects', async () => {
      mockAiModel.generateContentStream.mockResolvedValue(
        createMockTtsStream([
          { data: 'SGVsbG8=', mimeType: 'audio/l16; rate=24000; channels=1' },
          { data: 'V29ybGQ=', mimeType: 'audio/l16; rate=24000; channels=1' },
        ]),
      );

      const generator = service.synthesizeStream({ text: 'Dynamic Stream', voice: 'Kore' });
      const emissions = [];
      for await (const chunk of generator) {
        emissions.push(chunk);
      }

      expect(mockAiModel.generateContentStream).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Dynamic Stream' }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
            languageCode: 'en-US',
          },
        },
      });
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
      mockAiModel.generateContentStream.mockRejectedValue(new Error('Vertex AI stream error'));

      const generator = service.synthesizeStream({ text: 'Failing stream', voice: 'Puck' });
      await expect(generator.next()).rejects.toThrow('Vertex AI stream error');
    });
  });
});
