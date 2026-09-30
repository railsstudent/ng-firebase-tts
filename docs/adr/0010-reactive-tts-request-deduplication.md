# 0010: Reactive Text-to-Speech Request Deduplication and Atomic State Snapshotting

- **Status**: Accepted
- **Date**: 2026-09-30

## Context

The application generates speech by communicating with Firebase AI Logic (Gemini API) via `TextToSpeechService`. Users configure speech prompts via a Signal Form in `AudioTagsComponent`, which computes an `audioPrompt` (incorporating `scene`, `emotion`, `pace`, and the `interestingFact` transcript) and passes it alongside `voice` to `TextToSpeechComponent`.

Previously, every click on a generation action (`sync` or `stream`) triggered a new synthesis request to Firebase AI Logic, even when neither the `audioPrompt` nor the selected `voice` had changed since the previous generation.

This resulted in:

1. **Unnecessary Cloud Consumption**: Generating speech repeatedly with identical inputs incurred redundant API requests to Firebase AI Logic.
2. **Disconnected Component State**: State variables (`#audioUrl` and playback loading states) were updated in pieces across service methods without an atomic representation linking the audio output directly to the input payload that generated it.
3. **Destructive State Resets**: Revoking Blob URLs prior to receiving a new synthesis response caused previous working audio to be lost if a subsequent network request failed.

## Decision

We introduce a reactive deduplication and atomic state snapshotting strategy in `TextToSpeechViewService` and `TextToSpeechComponent`:

1. **Atomic Audio State (`GeneratedAudioRecord`)**:
   - Define a strongly typed record representing generated audio:

     ```typescript
     export interface GeneratedAudioRecord {
       readonly url: string;
       readonly prompt: string;
       readonly voice: string;
     }
     ```

   - Manage active audio via a single private signal `#activeAudio = signal<GeneratedAudioRecord | null>(null)`.
   - Derive public `audioUrl` automatically via `computed(() => this.#activeAudio()?.url)`.

2. **Primitive Input Comparison & Deduplication**:
   - Speech requests sent to Firebase are uniquely and completely identified by `(prompt: string, voice: string)`.
   - In `sync` and `stream` modes, if `#activeAudio()` exists and matches both the target `prompt` and `voice`, `generateSpeech()` returns early without initiating an API request.
   - For `web_audio_api` mode, synthesis bypasses caching to support live streaming with dynamic randomized playback rates.

3. **Deferred Revocation for Error Resilience**:
   - Rather than revoking existing Blob URLs before starting a new network request, revocation and snapshot replacement occur only after the new synthesis successfully resolves.
   - If a new request fails or is aborted, the previous working audio and its matching snapshot remain intact and playable in the UI.
   - **In-Flight UI Suppression**: While a new generation or live stream is actively running (`isLoading() === true`), the component template suppresses the static `<audio>` player (`!isLoading() && audioUrl()`) to prevent simultaneous dual-playback conflicts with Web Audio streams, while keeping the snapshot in memory so it safely reappears if the operation errors out or once completed.

4. **Reactive Component Evaluation**:
   - `TextToSpeechComponent` derives `isGeneratedForCurrentInput = computed(...)` from the service's `#activeAudio` signal and the component inputs (`audioPrompt()`, `voice()`), providing a synchronous and reactive reflection of whether the displayed audio matches the active form state.

## Consequences

### Positive

- **Zero Redundant AI Invocations**: Repetitive clicks on `sync` or `stream` without modifying inputs skip Firebase AI Logic completely while preserving the rendered `<audio>` player.
- **Single Source of Truth**: Combining the Blob URL, payload inputs, and timestamp into a single signal prevents desynchronization between what is rendered and what inputs generated it.
- **Failure Resilience**: Network or synthesis errors on subsequent attempts no longer destroy previously generated, valid audio in the player.
- **Accurate Granularity**: By comparing the computed prompt string (which embeds tags and the fact transcript), changes in either the form settings or image analysis seamlessly invalidate the snapshot.

### Negative / Trade-offs

- **Memory Retention**: Preserving the active Blob URL until replaced or destroyed means the audio Blob remains in browser memory during subsequent in-flight requests until replaced or component destruction cleans it up via `DestroyRef`.
