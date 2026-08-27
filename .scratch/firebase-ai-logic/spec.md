# Specification: Firebase AI Logic Multimodal Voice Pipeline

## Problem Statement

To create an interactive and accessible multimodal experience, users need to upload images, get high-quality descriptions, find surprising or obscure facts connecting those images' key tags, and immediately hear that fact read aloud.

Furthermore, users in geographically restricted regions (specifically **Hong Kong**) cannot access the consumer-level Gemini Developer API, meaning a direct client-key key binding would cause fatal network blocks and break the entire Gen AI experience for this market. Additionally, running traditional Text-to-Speech (TTS) models requires setting up and paying for separate custom cloud backends (like Google Cloud TTS Functions), introducing maintenance complexity and extra latency.

---

## Solution

We will build a high-performance, completely serverless, client-side Gen AI voice pipeline utilizing the **Agent Platform Gemini API (Vertex AI for Firebase)**.

By routing AI calls through the Agent Platform mapped to unrestricted geographical locations (such as `global`), we guarantee full compliance and availability in Hong Kong. We will execute a 3-step pipeline: Multimodal Image Analysis, Surprising Fact Discovery (powered by live Google Search Grounding), and Native Text-to-Speech synthesis in a single unified client SDK flow using Gemini's native `audio` output modality (`responseModalities: ["audio"]`). This entirely eliminates the need for any backend or cloud functions, allowing the browser to decode and play base64-vocalized audio directly on the user's device.

---

## User Stories

1. As an international user located in Hong Kong, I want to upload an image and have it analyze successfully without regional blocks, so that the application is fully accessible.
2. As a user, I want the application to identify key elements of my image, so that it can find hidden, surprising, or obscure connections between those elements.
3. As a user, I want the generated facts to be grounded in real-world facts, so that I don't receive hallucinations or incorrect fabrications from the AI.
4. As a curious user, I want the system to link to the live Google Search entries it used, so that I can verify the citations and read more about the fact.
5. As a user with visual impairments or on-the-go preferences, I want to hear the generated fact read aloud in a natural human-like voice, so that the platform is accessible without looking at the screen.
6. As a frontend architect, I want the entire voice synthesis pipeline to run client-side without spinning up node-based Cloud Functions, so that the platform is easy to maintain and scale with zero backend costs.

---

## Implementation Decisions

### 1. Agent Platform (Vertex AI) Routing

To ensure availability for Hong Kong clients, the application routes all Gen AI calls through `AgentPlatformBackend` pointing to regional servers (such as `asia-east1`) specified dynamically in Remote Config.

### 2. The 3-Step Pipeline Orchestration

- **Step 1: Image Analysis**: Sends the image payload using `generateContent` with a structured `responseSchema` (`ImageAnalysisSchema`), forcing the model to output valid, parseable JSON containing tags, suggestions, and alt-text.
- **Step 2: Obscure Fact Discovery**: Uses the output tags from Step 1 and runs another prompt with the Google `googleSearch` tool active. The AI queries the web to discover unexpected linkages.
- **Step 3: Native Audio Generation (TTS)**: The resulting obscure fact is passed to the Gemini audio model with the configuration:
  - `responseModalities: ["audio"]`
  - `speechConfig`: Selecting a high-quality prebuilt voice (such as `"Kore"` or `"Puck"`).

### 3. Client-Side Web Audio Decoding & Playback

To keep the pipeline 100% serverless, the base64-encoded audio payload returned from Gemini is processed directly in the browser:

1. Decode the Base64 string into a raw binary `ArrayBuffer`.
2. Initialize a browser-native Web Audio `AudioContext`.
3. Call `decodeAudioData` to convert the binary payload into an audio buffer.
4. Connect the buffer to the context's destination and trigger instant, low-latency playback.

---

## Testing Decisions

### What Makes a Good Test

- Tests must verify the pipeline behaves correctly at its public seams (such as verifying that `FirebaseService.generateAltText` parses JSON outputs correctly and returns proper tokens/metadata).
- We test that the Web Audio decoding routine handles corrupted or empty base64 strings gracefully without freezing the UI.

### Modules Tested

- `FirebaseService` (`src/app/core/services/firebase.service.ts`): Mocking the `GenerativeModel` responses to check tag generation and citation-parsing code.

---

## Out of Scope

- Building or hosting custom server-side voice synthesizers.
- Custom Voice cloning features (only prebuilt voices are utilized).

---

## Further Notes

- By hosting the Gen AI backend on the Agent Platform (Vertex AI), we achieve both compliance in regional restricted zones (Hong Kong) and exceptional quality-of-service through enterprise-grade SLA limits.
