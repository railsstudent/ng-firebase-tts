# ng-firebase-tts

A client-side Angular application demonstrating real-time streaming text-to-speech (TTS) and multimodal image analysis powered directly by Firebase AI Logic (Vertex AI for Firebase) and Gemini models with zero server-side orchestration.

## Language

### Audio & Speech Synthesis

**Linear PCM (L16)**:
The uncompressed 16-bit Pulse-Code Modulation audio data format (`audio/l16`) returned in chunked streams by the Gemini TTS model.
_Avoid_: Raw bytes, compressed audio, MP3, audio payload

**WAV Conversion**:
The client-side process of prepending a 44-byte RIFF/WAVE header to merged Linear PCM buffers to construct a playable `audio/wav` Blob for standard media elements.
_Avoid_: Audio transcoding, server encoding, MP3 conversion

**Gapless Timeline Playback**:
The technique of scheduling incoming Float32 PCM sample buffers on an active Web Audio API `AudioContext` timeline at calculated future timestamps to prevent audio gaps, stutter, or clicks.
_Avoid_: Audio chunk queuing, interval playing, naive audio play

**Voice Profile**:
A prebuilt Gemini speech persona (e.g. `Aoede`, `Charon`, `Fenrir`, `Kore`, `Puck`, `Zephyr`) configured in the speech generation parameters. Presented in the user interface as the **AI Voice Model**.
_Avoid_: Speaker name, voice actor, voice ID

**Speech Generation Mode**:
The client-side strategy used to synthesize and play audio: `Synchronous` (full buffer generation before playback), `Stream` (chunked playback via Media Source), or `Web Audio API` (real-time gapless timeline scheduling).
_Avoid_: Audio mode, player type, playback format

**Audio Prompt**:
A structured text input composed of generated image facts, tags, or alternative text combined with tone instructions sent to the Gemini TTS model.
_Avoid_: Speech text, TTS input, narration script

**Vocal Customization (Audio Tags)**:
The contextual parameter set consisting of **Scene Description**, **Vocal Emotion**, and **Speaking Pace** combined with a chosen Voice Profile to shape the synthesized speech delivery.
_Avoid_: Speech parameters, voice filters, audio metadata

### Image Analysis & Multimodal Vision

**Image Analysis**:
The multimodal Gemini task that inspects an uploaded image to produce structured alternative text, descriptive tags, improvement recommendations, and an obscure fact.
_Avoid_: Photo scanning, OCR, vision tagging

**Obscure Fact**:
A surprising, non-obvious trivia item discovered by Gemini with Google Search grounding that interconnects the descriptive tags extracted from an image.
_Avoid_: Trivia, image description, random fact

**Search Grounding / Citations**:
Live Google Search web chunks and entry point metadata attached to the Gemini vision response to verify facts and attribute sources.
_Avoid_: External links, search references, web scrapings

**Recommendation**:
An actionable, numbered suggestion provided by Gemini to make an analyzed image more engaging or visually interesting.
_Avoid_: Suggestion, tip, image advice

### Headless Accessible Components & UI Patterns

**Accessible Combobox**:
An accessible dropdown selector combining `@angular/aria` (`ngCombobox`, `ngListbox`) and `@angular/cdk/overlay` with active-descendant focus management and collision-aware popover positioning.
_Avoid_: Custom select, dropdown menu, select box

**Explicit Single-Select Listbox**:
A horizontal tag selector (`ngListbox`) configured with explicit selection mode (`selectionMode="explicit"`, `multi="false"`), supporting toggleable click-to-select / click-to-deselect behavior and dynamic screen-reader count announcements.
_Avoid_: Tag list, button pills, chip array

**Lazy-Rendered Accordion**:
A multi-expandable collapsible container (`ngAccordionGroup`, `[multiExpandable]="true"`) utilizing `<ng-template ngAccordionContent>` to defer DOM rendering of panel contents until expanded by the user.
_Avoid_: Collapsible panel, accordion widget, expandable card

### Core Architecture & Configuration

**Firebase AI Logic**:
The client-side Firebase SDK (`firebase/ai`) that authenticates and routes generative AI requests directly to Vertex AI without intermediary Cloud Functions or proxy servers.
_Avoid_: Vertex AI SDK, Gemini backend proxy, Firebase Cloud Functions

**Remote Config Defaults**:
The static local fallback values (models, locations, thinking levels) injected before or in absence of dynamic Firebase Remote Config fetch activation.
_Avoid_: App settings, hardcoded config, environment defaults

**Reasoning Process / Thought Summary**:
The model's internal thinking steps (`thoughtSummary()`) executed when utilizing a thinking budget, providing transparency into the model's reasoning prior to returning the final output.
_Avoid_: System thought, hidden reasoning, internal prompt, chain-of-thought log

**Token Usage Tracking**:
The precise measurement of input, output, and thought tokens consumed during an AI request to monitor performance and efficiency.
_Avoid_: Billing count, raw token metadata, cost tracking, api charges

### PWA & Offline Capability

**PWA Update Service**:
The core application service that monitors for service worker registration updates and coordinates app version refresh workflows.
_Avoid_: Offline app, service worker controller, caching daemon

**Service Worker Update Banner**:
The visual component that notifies the user when an updated version of the application has been cached and is ready to be activated.
_Avoid_: Notification box, update alert, modal reload popup

**Asset Cache Manifest**:
The pre-configured offline asset configuration (`ngsw-config.json`) defining the file patterns and caching strategies (prefetch or lazy) for static application shell resources.
_Avoid_: App cache, cache list, offline manifest, raw SW config
