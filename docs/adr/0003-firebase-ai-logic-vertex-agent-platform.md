# 0003: Regional Compliance and Native Voice Generation via Agent Platform

- **Status**: Accepted
- **Date**: 2026-08-28

## Context

Our application targets international users, including those in **Hong Kong**. Standard Gemini Developer API keys are geographically restricted and fail in Hong Kong. Therefore, we must use the **Agent Platform Gemini API (Vertex AI for Firebase)** which remains fully available.

Furthermore, we require Text-to-Speech (TTS) capabilities to synthesize vocalizations of generated facts. Traditional TTS approaches require integrating external Cloud Functions, writing server-side Node handlers, or paying for third-party Speech APIs, adding substantial codebase weight and latency.

### Sibling Repository Reference

Our companion repository implements this via a Firebase Cloud Function that handles chunked streams and manually prepends custom 44-byte WAV headers for client-side blob URL construction. You can find that Node-based implementation at:

- **Path**: `../firebase-ai-hybrid-demo/firebase/functions/src/text-to-audio/read-fact.ts`

Porting this Node-specific server-side buffering, `Buffer` streams, and manual WAV header construction to the client-side is complex and error-prone.

## Decision

We will utilize the **Agent Platform Gemini API (Vertex AI)** as our long-term Gen AI and Text-to-Speech backbone:

1. **Regional Routing**: Initialize generative models via `AgentPlatformBackend` pointing to unrestricted regions (e.g., `asia-east1`).
2. **Native Text-to-Speech Generation**: Bypass separate voice APIs and leverage Gemini's native audio capabilities by invoking the model with:
   - `responseModalities: ["audio"]`
   - `speechConfig` containing a prebuilt voice setting (e.g., `voiceName: "Kore"` or `"Puck"`).
3. **Hybrid PCM/WAV Audio Architecture**: We will support both high-performance direct raw PCM streaming and standard HTML5 file-based playback:
   - **Raw Streaming Playback (`speak`)**: For zero-latency, real-time audio playback, we bypass container headers and feed raw, headerless PCM byte arrays directly to the Web Audio API (`AudioPlayerService`), converting them to Float32 samples dynamically.
   - **Single-shot File Playback (`synthesize` / `synthesizeStream`)**: Standard HTML5 `<audio>` elements do not natively support headerless linear PCM. To enable standard play, pause, duration, and scrubbing controls, we dynamically wrap raw PCM bytes with a browser-safe 44-byte RIFF/WAVE header (ported from companion backend Node.js logic using browser-native `ArrayBuffer` and `DataView`) to return standard playable `'audio/wav'` Blobs.

---

## Architectural Blueprint & Pseudo-Code

```typescript
// ==========================================
// 1. VISION SERVICE (src/app/core/services/vision.service.ts)
// ==========================================
@Service()
export class VisionService {
  private aiModel = inject(VISION_AI_MODEL);

  async analyzeImage(image: File): Promise<ImageAnalysisResponse> {
    const imagePart = await fileToGenerativePart(image);
    const result = await this.aiModel.generateContent([PROMPT, imagePart]);
    return parseResult(result);
  }
}

// ==========================================
// 2. AUDIO PLAYER SERVICE (src/app/core/services/audio-player.service.ts)
// ==========================================
@Service()
export class AudioPlayerService implements OnDestroy {
  private audioCtx: AudioContext | undefined = undefined;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  playbackRate = signal(1); // Reactive speed control

  initialize(sampleRate = 24000): void {
    this.stopAll();
    this.audioCtx = new AudioContext({ sampleRate });
    this.nextStartTime = this.audioCtx.currentTime;
  }

  processChunk(rawBytes: Uint8Array): void {
    if (!this.audioCtx) return;

    const float32Samples = this.normalizeSamples(rawBytes);
    if (float32Samples.length === 0) return;

    const buffer = this.audioCtx.createBuffer(1, float32Samples.length, this.audioCtx.sampleRate);
    buffer.copyToChannel(float32Samples, 0);

    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.playbackRate.value = this.playbackRate();
    sourceNode.connect(this.audioCtx.destination);

    this.activeSources.push(sourceNode);

    const playTime = Math.max(this.nextStartTime, this.audioCtx.currentTime);
    sourceNode.start(playTime);

    const duration = buffer.duration / this.playbackRate();
    this.nextStartTime = playTime + duration;

    sourceNode.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
    };
  }

  stopAll(): void {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    this.audioCtx?.close();
    this.audioCtx = undefined;
  }

  private normalizeSamples(rawBytes: Uint8Array): Float32Array {
    const byteLength =
      rawBytes.byteLength % 2 === 0 ? rawBytes.byteLength : rawBytes.byteLength - 1;
    const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, byteLength / 2);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }
    return float32Data;
  }
}

// ==========================================
// 3. TEXT TO SPEECH SERVICE (src/app/core/services/text-to-speech.service.ts)
// ==========================================
@Service()
export class TextToSpeechService {
  private aiBackend = inject(AI_BACKEND); // Injected regional AgentPlatformBackend instance
  private audioPlayer = inject(AudioPlayerService); // Injected player utility

  /**
   * USE CASE 3 (Zero-Latency Immediate Playback):
   * Streams the voice data chunk-by-chunk and plays it immediately.
   */
  async speak(text: string, voiceName: string): Promise<void> {
    this.audioPlayer.initialize(24000);
    const model = this.createModel(voiceName);

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const base64Data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Data) {
          const rawBytes = this.decodeBase64(base64Data);
          this.audioPlayer.processChunk(rawBytes); // Plays immediately!
        }
      }
    } catch (e) {
      console.error('Streaming playback failed:', e);
      this.audioPlayer.stopAll();
      throw e;
    }
  }

  /**
   * USE CASE 2 (Streaming WAV Assembly):
   * Streams chunks, compiles them, and returns a playable WAV Blob.
   */
  async synthesizeStream(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName);
    const chunks: Uint8Array[] = [];

    try {
      const responseStream = await model.generateContentStream([text]);
      for await (const chunk of responseStream.stream) {
        const inlineData = extractInlineData(chunk);
        if (inlineData?.data) {
          chunks.push(decodeBase64(inlineData.data));
        }
      }
      const rawBytes = concatenateChunks(chunks);
      return convertToWav(rawBytes, 'audio/l16; rate=24000; channels=1');
    } catch (e) {
      console.error('Streaming WAV assembly failed:', e);
      throw e;
    }
  }

  /**
   * USE CASE 1 (Ad-hoc Single-shot):
   * Fetches the entire audio content at once, converts raw PCM to WAV, and returns a playable Blob.
   */
  async synthesize(text: string, voiceName: string): Promise<Blob> {
    const model = this.createModel(voiceName);

    try {
      const response = await model.generateContent([text]);
      const inlineData = extractInlineData(response);
      if (!inlineData?.data) {
        throw new Error('No audio data received in response.');
      }

      const rawBytes = decodeBase64(inlineData.data);
      return convertToWav(rawBytes, inlineData.mimeType);
    } catch (e) {
      console.error('Ad-hoc single-shot synthesis failed:', e);
      throw e;
    }
  }

  private createModel(voiceName: string) {
    const modelName = 'gemini-2.0-flash-exp';
    return getGenerativeModel(this.aiBackend, {
      model: modelName,
      generationConfig: {
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
  }

  private decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
```

## Consequences

### Positive

- **Zero Server-Side Maintenance**: TTS is handled completely client-side via the Firebase Web SDK, eliminating Cloud Functions, server billing, and custom backend infrastructure.
- **Client-Side Decoding & Memory Playback**: Decoding the raw base64 audio string directly into an ArrayBuffer via Web Audio API means the app doesn't need to write temporary files to cloud storage, completely avoiding transient file accumulation, disk cleanups, and storage costs.
- **Standard Compatibility & Native Controls via Client-Side WAV Wrapping**: For single-shot file-based playbacks, we successfully ported the companion backend's 44-byte WAV header assembly to the client using browser-native typed arrays (`ArrayBuffer`/`DataView`). This turns raw linear PCM bytes into standard playable `'audio/wav'` Blobs, enabling standard HTML5 `<audio>` players to display seek, volume, and duration controls natively. We still retain direct headerless playback for zero-latency streaming synthesis via the Web Audio API.
- **Full Regional Compliance**: Routable via safe regional clusters (e.g., `asia-east1`) guaranteeing zero-block access for users in Hong Kong.
- **Robust Schema Matching**: Forcing Gemini to output structural JSON matching our schema prevents model hallucination or UI rendering failures.

### Negative / Trade-offs

- Requires the Firebase project to be on the **Blaze pay-as-you-go** billing plan.
