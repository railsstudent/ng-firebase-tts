# System Architecture: Client-Side Audio & Vision Pipelines

This document provides a technical design overview of how `ng-firebase-tts` implements client-side generative AI and real-time Text-to-Speech (TTS) synthesis natively in the browser without server-side compute.

---

## High-Level Pipeline Architecture

The application is split into two distinct, decoupled pipelines: **Vision (Image Analysis)** and **Speech (Voice Synthesis)**. They communicate via stateless data payloads across clean architectural seams.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant Comp as UI Component
    participant VS as VisionService
    participant TTS as TextToSpeechService
    participant AP as AudioPlayerService
    participant RC as Remote Config
    participant VAI as Vertex AI (Gemini)

    %% Step 1: Remote Config Resolution
    Note over User, VAI: 1. Runtime Setup
    User->>RC: Fetch Remote Config
    RC-->>User: geminiModelName, vertexAILocation, thinkingLevel

    %% Step 2: Vision Pipeline
    Note over User, VAI: 2. Vision (Image-to-Text) Pipeline
    User->>Comp: Upload Image File
    Comp->>VS: analyzeImage(image)
    VS->>VAI: generateContent([Prompt, ImagePart]) (Multimodal)
    VAI-->>VS: JSON response (ImageAnalysis)
    VS-->>Comp: Return ImageAnalysisResponse

    %% Step 3: Speech Pipeline (Three Use Cases)
    Note over User, VAI: 3. Speech (Text-to-Speech) Pipeline

    alt Use Case 1: Ad-hoc Single-shot Synthesis (synthesize)
        Comp->>TTS: synthesize(text, voiceName)
        TTS->>VAI: generateContent([text]) (Audio-Modality)
        VAI-->>TTS: Complete response (base64 PCM data)
        TTS->>TTS: Decode base64 to Blob (audio/pcm)
        TTS-->>Comp: Return Object URL (blob:http://...)
        Comp->>User: Play natively via HTML5 <audio src="blobURL">

    else Use Case 2: Pure Streaming to Callback (synthesizeStream)
        Comp->>TTS: synthesizeStream(text, voiceName, onChunk)
        TTS->>VAI: generateContentStream([text]) (Audio-Modality)
        loop Stream Chunks
            VAI-->>TTS: Chunk (base64 PCM data)
            TTS->>TTS: Decode base64 to raw bytes
            TTS-->>Comp: Trigger onChunk(rawBytes) (e.g. for visualizers or recording)
        end
        TTS-->>Comp: Stream completed

    else Use Case 3: Zero-Latency Interactive Playback (speak)
        Comp->>TTS: speak(text, voiceName)
        Note over TTS: TTS injects AudioPlayerService internally
        TTS->>AP: initialize(24000)
        TTS->>VAI: generateContentStream([text]) (Audio-Modality)
        loop Stream Chunks
            VAI-->>TTS: Chunk (base64 PCM data)
            TTS->>TTS: Decode base64 to raw bytes
            TTS->>AP: processChunk(rawBytes)
            AP->>AP: Normalize PCM & play gaplessly via AudioContext
        end
        TTS-->>Comp: Synthesis & playback completed
    end
```

---

## Architectural Responsibility Breakdown

### 1. Vision Pipeline (`VisionService`)

- **Role**: Handles multimodal parsing of local browser binary files into Generative Parts.
- **Interface**: Small, focused signature taking a native `File` object and returning structured, typed JSON data.
- **Decoupling**: Independent of speech generation; its outputs are raw JSON facts that can be fed into any downstream consumer.

### 2. Synthesis Pipeline (`TextToSpeechService`)

- **Role**: Orchestrates the communication with Vertex AI for Firebase using the dynamic, regional `AgentPlatformBackend`. It manages dynamic, on-the-fly model creation based on user voice presets.
- **Dependency Injection**: Injects the low-level `AudioPlayerService` directly to handle Use Case 3 (Zero-latency playback) autonomously.
- **Trio of Supported Operations**:
  - **Use Case 1 (Ad-hoc)**: `synthesize(text, voiceName)`: Returns a standard Blob Object URL.
  - **Use Case 2 (Pure Streaming)**: `synthesizeStream(text, voiceName, onChunk)`: Feeds raw decoded bytes to a caller's custom callback (perfect for visualizers).
  - **Use Case 3 (Immediate Playback)**: `speak(text, voiceName)`: Direct piping to the injected `AudioPlayerService` for immediate speaker output, reducing waiting latency to near-zero.

### 3. Playback Pipeline (`AudioPlayerService`)

- **Role**: Manages browser-level Web Audio API contexts.
- **Zero-Header Processing**: Completely bypasses complex, server-side WAV header assembly. Converts raw, headerless mono 16-bit PCM streams into standard Float32 audio samples.
- **Gapless Scheduling**: Chronologically queues sequential audio buffers using precise `AudioContext.currentTime` scheduling, preventing any clicking, popping, or playback delay.
