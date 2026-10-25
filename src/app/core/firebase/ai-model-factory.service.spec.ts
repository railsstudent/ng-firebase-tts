import type { MockConfigService } from '@/testing/config.mock';
import { createMockAiBackend, createMockConfigService } from '@/testing/config.mock';
import { TestBed } from '@angular/core/testing';
import {
  getGenerativeModel,
  HarmBlockThreshold,
  HarmCategory,
  ResponseModality,
  Schema,
  ThinkingLevel,
} from 'firebase/ai';
import { AiModelFactory } from './ai-model-factory.service';
import { ConfigService } from './config.service';

describe('AiModelFactory', () => {
  let factory: AiModelFactory;
  let mockConfigService: MockConfigService;
  const mockGetGenerativeModel = vi.mocked(getGenerativeModel);

  beforeEach(() => {
    mockGetGenerativeModel.mockClear();
    mockConfigService = createMockConfigService({
      appConfig: {
        geminiModelName: 'gemini-2.5-flash',
        geminiTTSModelName: 'gemini-2.5-flash-preview-tts',
        thinkingLevel: ThinkingLevel.LOW,
      },
    });

    TestBed.configureTestingModule({
      providers: [AiModelFactory, { provide: ConfigService, useValue: mockConfigService }],
    });

    factory = TestBed.inject(AiModelFactory);
  });

  describe('getModel', () => {
    it('should create a model with default model and thinking level without tools or schema when none are provided', async () => {
      const model = await factory.getModel();

      expect(model).toBeDefined();
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          model: 'gemini-2.5-flash',
          generationConfig: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
              includeThoughts: true,
            },
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        }),
      );
      expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tools: expect.anything() }),
      );
    });

    it('should attach custom model, tools, responseSchema, responseMimeType: application/json, and systemInstruction when provided', async () => {
      const testSchema = Schema.object({ properties: { label: Schema.string() } });

      await factory.getModel({
        schema: testSchema,
        systemInstruction: 'Analyze carefully',
        tools: [{ googleMaps: {} }],
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          systemInstruction: 'Analyze carefully',
          tools: [{ googleMaps: {} }],
          generationConfig: {
            responseSchema: testSchema,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
              includeThoughts: true,
            },
          },
        }),
      );
    });

    it('should return the cached model when called with identical model, tools, systemInstruction, and schema', async () => {
      const schemaA = Schema.object({ properties: { tag: Schema.string() } });
      const schemaB = Schema.object({ properties: { tag: Schema.string() } });

      const first = await factory.getModel({
        schema: schemaA,
        systemInstruction: 'Prompt 1',
        tools: [{ googleSearch: {} }],
      });
      const second = await factory.getModel({
        schema: schemaB,
        systemInstruction: 'Prompt 1',
        tools: [{ googleSearch: {} }],
      });

      expect(first).toBe(second);
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
    });

    it('should create distinct cached instances when model, tools, schema, or systemInstruction differs', async () => {
      const schema = Schema.object({ properties: { a: Schema.string() } });

      await factory.getModel({ schema, systemInstruction: 'Inst A', tools: [{ googleSearch: {} }] });
      await factory.getModel({ schema, systemInstruction: 'Inst A', tools: [{ googleMaps: {} }] });
      await factory.getModel({ schema, systemInstruction: 'Inst B', tools: [{ googleSearch: {} }] });

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(3);
    });
  });

  describe('getTtsModel', () => {
    it('should create and cache a single TTS model configured with ResponseModality.AUDIO', async () => {
      const first = await factory.getTtsModel();
      const second = await factory.getTtsModel();

      expect(first).toBe(second);
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.anything(), {
        model: 'gemini-2.5-flash-preview-tts',
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
        },
      });
    });
  });

  describe('Backend Invalidation on Remote Config Update', () => {
    it('should clear cached models when ConfigService.getAiBackend returns a new backend instance', async () => {
      await factory.getModel();
      await factory.getTtsModel();
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);

      // Simulate Remote Config update returning a new AI backend instance
      const refreshedBackend = createMockAiBackend({ options: { projectId: 'refreshed-project' } });
      mockConfigService.getAiBackend.mockResolvedValue(refreshedBackend);

      await factory.getModel();
      await factory.getTtsModel();

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(4);
    });
  });
});
