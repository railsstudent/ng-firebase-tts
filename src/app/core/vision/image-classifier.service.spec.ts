import { WINDOW } from '@/core/constants/navigator.const';
import { ConfigService } from '@/core/firebase';
import { createMockAppRemoteConfig, createMockConfigService } from '@/testing/config.mock';
import { TestBed } from '@angular/core/testing';
import { ImageClassifierService } from './image-classifier.service';

const { mockForDecisionTasks, mockCreateFromOptions, mockPrewarmChoice, mockEvaluateChoice } = vi.hoisted(() => ({
  mockForDecisionTasks: vi.fn(),
  mockCreateFromOptions: vi.fn(),
  mockPrewarmChoice: vi.fn(),
  mockEvaluateChoice: vi.fn(),
}));

vi.mock('@mediapipe/tasks-decision', () => ({
  FilesetResolver: {
    forDecisionTasks: mockForDecisionTasks,
  },
  DecisionMaker: {
    createFromOptions: mockCreateFromOptions,
  },
}));

describe('ImageClassifierService', () => {
  let service: ImageClassifierService;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockWindow: { navigator: Record<string, unknown> } | null;
  const sampleBytes = new Uint8Array([1, 2, 3, 4]);
  const mockWasmFileset = { wasmLoaderPath: '/wasm/decision_wasm_internal.js' };

  function configureService(): ImageClassifierService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ImageClassifierService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WINDOW,
          useValue: mockWindow,
        },
      ],
    });
    return TestBed.inject(ImageClassifierService);
  }

  beforeEach(() => {
    mockForDecisionTasks.mockReset().mockResolvedValue(mockWasmFileset);
    mockPrewarmChoice.mockReset().mockResolvedValue(undefined);
    mockEvaluateChoice.mockReset().mockResolvedValue({
      selectedKey: 'general',
      confidence: 0.75,
      probabilities: { general: 0.75, people: 0.15, place: 0.1 },
    });
    mockCreateFromOptions.mockReset().mockResolvedValue({
      prewarmChoice: mockPrewarmChoice,
      evaluateChoice: mockEvaluateChoice,
    });

    mockWindow = {
      navigator: {
        gpu: {},
      },
    };
    mockConfigService = createMockConfigService();
    service = configureService();
  });

  it('should initialize DecisionMaker with /wasm and GPU delegate and prewarm only once across multiple classifyImage calls', async () => {
    await service.classifyImage(sampleBytes);
    await service.classifyImage(sampleBytes);

    expect(mockForDecisionTasks).toHaveBeenCalledTimes(1);
    expect(mockForDecisionTasks).toHaveBeenCalledWith('/wasm');
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: mockConfigService.appConfig.decisionModelPath,
        delegate: 'GPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
    expect(mockPrewarmChoice).toHaveBeenCalledTimes(1);
    expect(mockPrewarmChoice).toHaveBeenCalledWith({
      context: 'Analyze the uploaded image for accessibility alt-text routing.',
      instructions:
        'Classify the primary subject category of this image. If a landmark, pyramid, monument, or scenic travel location is visible behind a person, select place.',
      options: [
        expect.objectContaining({ label: 'place', description: expect.any(String) }),
        expect.objectContaining({ label: 'people', description: expect.any(String) }),
        expect.objectContaining({ label: 'general', description: expect.any(String) }),
      ],
      temperature: 0.05,
      normalizePrior: false,
    });
    expect(mockEvaluateChoice).toHaveBeenCalledTimes(2);
    expect(mockEvaluateChoice).toHaveBeenCalledWith(
      { imageBytes: sampleBytes },
      expect.objectContaining({
        context: 'Analyze the uploaded image for accessibility alt-text routing.',
        instructions:
          'Classify the primary subject category of this image. If a landmark, pyramid, monument, or scenic travel location is visible behind a person, select place.',
        options: [
          expect.objectContaining({ label: 'place', description: expect.any(String) }),
          expect.objectContaining({ label: 'people', description: expect.any(String) }),
          expect.objectContaining({ label: 'general', description: expect.any(String) }),
        ],
        temperature: 0.05,
        normalizePrior: false,
      }),
    );
  });

  it('should fast-fail to "general" without loading WASM when imageBytes is empty', async () => {
    const category = await service.classifyImage(new Uint8Array(0));

    expect(category).toBe('general');
    expect(mockForDecisionTasks).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).not.toHaveBeenCalled();
  });

  it('should fast-fail to "general" without loading WASM or downloading model when WebGPU is unavailable for a .litertlm model', async () => {
    mockWindow = { navigator: {} };
    service = configureService();

    const category = await service.classifyImage(sampleBytes);

    expect(category).toBe('general');
    expect(mockForDecisionTasks).not.toHaveBeenCalled();
    expect(mockCreateFromOptions).not.toHaveBeenCalled();
  });

  it('should fall back to CPU delegate when WebGPU is unavailable and decisionModelPath is a .task model', async () => {
    mockWindow = { navigator: {} };
    mockConfigService = createMockConfigService({
      appConfig: createMockAppRemoteConfig({
        decisionModelPath: 'https://example.com/models/laya.task',
      }),
    });
    service = configureService();

    await service.classifyImage(sampleBytes);

    expect(mockCreateFromOptions).toHaveBeenCalledWith(mockWasmFileset, {
      baseOptions: {
        modelAssetPath: 'https://example.com/models/laya.task',
        delegate: 'CPU',
      },
      backendType: 3,
      maxNumTokens: 512,
    });
  });

  it('should return "people" when evaluateChoice selects "people" above the confidence threshold', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'people',
      confidence: 0.85,
      probabilities: { people: 0.85, place: 0.1, general: 0.05 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('people');
  });

  it('should return "place" when evaluateChoice selects "place" above the confidence threshold', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'place',
      confidence: 0.72,
      probabilities: { place: 0.72, people: 0.2, general: 0.08 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('place');
  });

  it('should return "general" when evaluateChoice selects "general" or an unrecognized key', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'general',
      confidence: 0.6,
      probabilities: { general: 0.6, people: 0.2, place: 0.2 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('general');
  });

  it('should fall back to "general" when confidence is below decisionConfidenceThreshold (0.4)', async () => {
    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'place',
      confidence: 0.39,
      probabilities: { place: 0.39, people: 0.31, general: 0.3 },
    });

    const category = await service.classifyImage(sampleBytes);
    expect(category).toBe('general');
  });

  it('should log console.warn, fall back to "general" when initialization rejects, and retry initialization on the next call', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCreateFromOptions.mockRejectedValueOnce(new Error('Network timeout'));

    const firstAttempt = await service.classifyImage(sampleBytes);
    expect(firstAttempt).toBe('general');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'people',
      confidence: 0.9,
      probabilities: { people: 0.9, place: 0.05, general: 0.05 },
    });

    const secondAttempt = await service.classifyImage(sampleBytes);
    expect(secondAttempt).toBe('people');
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('should log console.warn and return "general" when evaluateChoice rejects while keeping DecisionMaker cached', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockEvaluateChoice.mockRejectedValueOnce(new Error('Corrupt image bytes'));

    const firstAttempt = await service.classifyImage(sampleBytes);
    expect(firstAttempt).toBe('general');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    mockEvaluateChoice.mockResolvedValueOnce({
      selectedKey: 'place',
      confidence: 0.88,
      probabilities: { place: 0.88, people: 0.06, general: 0.06 },
    });

    const secondAttempt = await service.classifyImage(sampleBytes);
    expect(secondAttempt).toBe('place');
    expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
