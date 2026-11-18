# Specification: Persistent Browser Caching for On-Device Image Classification Model

**Status**: `ready-for-agent`

## Problem Statement

When users upload a photo to the **TTS Studio Workspace**, **On-Device Image Classification** evaluates the image locally in the browser to determine its **Image Subject Category** (`place`, `people`, or `general`) before dispatching the cloud **Image Analysis** request. However, the on-device vision-language model weighs several hundred megabytes and is hosted remotely. Because standard browser HTTP caches routinely evict or bypass single files of that size, refreshing the page or reopening the application in a new browser tab forces the browser to re-download the entire multi-hundred-megabyte model over the internet on the first image analysis. This causes a noticeable multi-second network delay after every page refresh and risks leaving orphaned model files on the user's device if caching is added without automatic version cleanup.

## Solution

Persist the **On-Device Image Classification** model locally in the browser with automatic outdated-model cleanup and memory reclamation:

1. **Download Once, Reuse Across Page Refreshes**: On the first **On-Device Image Classification** request (when hardware acceleration is supported), check local browser storage for the configured model. If the model is not yet stored locally, download it once, save it locally, and load the classifier from the stored copy. On every subsequent page refresh or newly opened browser tab, load the model directly from local browser storage without downloading it over the internet again.
2. **Automatic Outdated-Model Cleanup**: Whenever the active model configured via Firebase Remote Config (or **Remote Config Defaults**) is loaded, automatically remove any previously stored models that no longer match the active configuration. This guarantees that at most one model occupies disk space on the user's device and requires no manual cache-management buttons in the user interface.
3. **Temporary Memory Reclamation**: Immediately release any temporary in-memory buffers used while transferring the locally stored model into the classifier (both when startup succeeds and when startup fails), preventing duplicate copies of the model from remaining in system memory.
4. **Hardware & Error Fast-Paths Preserved**: Continue determining hardware compatibility before accessing local storage or the network (so devices without GPU acceleration still skip GPU-only models immediately), and gracefully fall back to direct remote loading or the `general` **Image Subject Category** if local browser storage is unavailable, restricted in private browsing, or out of disk space.

## User Stories

1. As a returning user who refreshes the **TTS Studio Workspace** or reopens the application in a new browser tab and uploads a photo, I want the **On-Device Image Classification** model to load directly from my browser's local storage without re-downloading hundreds of megabytes over the internet, so that my first **Image Analysis** after a refresh starts within seconds instead of waiting on a large network download.
2. As a first-time visitor uploading my first photo on a GPU-capable device, I want the application to download the on-device model once and save it locally in my browser automatically, so that page refreshes and newly opened browser tabs do not repeat the download.
3. As a user uploading multiple photos in the same browser tab without refreshing the page, I want the already-warmed classifier in active memory to be reused directly without re-reading disk storage on the second and subsequent photos, so that consecutive classifications remain instantaneous.
4. As an application administrator who updates the on-device model in Firebase Remote Config, I want the application to automatically remove any previously cached models that no longer match the active configuration, so that outdated multi-hundred-megabyte models never accumulate on users' disks.
5. As an end user of the **TTS Studio Workspace**, I want model caching and outdated-model cleanup to happen silently in the background without adding manual "Cache Model" or "Delete Cache" buttons to the interface, so that the workspace stays clean and focused on accessibility and speech generation.
6. As a user on a device with limited system memory (RAM), I want any temporary memory allocated while loading the cached model into the classifier to be released immediately after startup completes, so that my browser never holds duplicate copies of the model in memory.
7. As a user whose classifier startup fails after reading the cached model, I want any temporary memory allocated during loading to still be released during error recovery, so that failed startups never leak memory.
8. As a user on a browser or device without GPU acceleration when a GPU-only model is configured, I want the application to check hardware compatibility before accessing local storage or downloading the model, so that my device immediately falls back to the `general` **Image Subject Category** without unnecessary disk or network activity.
9. As a user browsing in an environment where local browser storage is unsupported, disabled, or out of disk space, I want the classifier to seamlessly fall back to loading the configured model directly (or falling back to the `general` **Image Subject Category** if the network also fails), so that **Image Analysis** continues working reliably.
10. As a user experiencing a temporary network interruption while downloading the model on the first visit, I want the application to avoid saving incomplete downloads locally and allow the next photo upload to retry cleanly, so that a failed download never corrupts local storage.

## Implementation Decisions

The technical architecture and storage mechanics are governed by [ADR 0015: Persistent Browser Cache Storage and Automatic Eviction for On-Device Decision Model](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0015-persistent-browser-caching-for-on-device-decision-model.md) and [ADR 0014: On-Device Image Classification with MediaPipe Decision Maker and Specialized Vision Routing](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0014-on-device-image-classification-and-specialized-vision-routing.md).

### 1. Persistent Local Model Storage & Automatic Cleanup

- **Dedicated Model Storage**:
  - The on-device classifier stores the downloaded model in dedicated browser storage separate from the application shell's **Asset Cache Manifest**.
- **Single Active Model Rule**:
  - Whenever the classifier initializes for the active model configured via Firebase Remote Config (or **Remote Config Defaults**), it removes any previously stored models that do not match the active model configuration.
  - This guarantees zero orphaned disk space when switching models via Firebase Remote Config and requires no user-facing cache management controls.
- **First Visit vs. Repeat Visit Behavior**:
  - **Repeat Visit (Cached)**: When the active model is already stored locally, the classifier loads directly from local storage without making a network request.
  - **First Visit (Not Cached)**: When the active model is not yet stored locally, the application downloads it from the configured source and saves only complete, successful downloads into local storage before initializing the classifier.

### 2. Hardware Compatibility, Active Tab Reuse & Memory Reclamation

- **Hardware Check First**:
  - Hardware compatibility is evaluated against the configured model before reading or writing local model storage. When GPU acceleration is unavailable and the configured model requires a GPU, classification immediately falls back to the `general` **Image Subject Category** without touching local storage or the network.
- **Active Browser Tab Reuse & Model Switch Replacement**:
  - While the current browser tab remains open without a page refresh and the configured model remains unchanged, the warmed-up classifier stays ready in memory so subsequent photo uploads in that tab do not re-read local disk storage.
  - If the configured model changes via Firebase Remote Config (or when the application shuts down), the previously loaded classifier in active memory is safely closed and released before the newly configured model is loaded and cached.
- **Temporary Memory Reclamation**:
  - Any temporary memory reference created to hand the cached model to the classifier is released immediately after classifier startup finishes—whether startup succeeds or fails—so duplicate model copies never remain in memory.

### 3. Graceful Fallback & Error Recovery

- If local browser storage is unavailable, blocked by privacy settings, out of disk space, or encounters a network failure during initial download, the classifier safely falls back to loading from the configured model source directly.
- If the classifier still cannot be loaded, the current photo seamlessly falls back to the `general` **Image Subject Category** and the next photo upload can retry cleanly.

## Testing Decisions

1. **First-Load Model Download & Local Persistence**:
   - Verify that when the configured model is not yet stored locally, analyzing an image downloads the model once, saves it into local storage, initializes the classifier from the local copy, and releases any temporary loading memory once ready.
2. **Zero-Network Reload After Page Refresh**:
   - Verify that when the configured model is already stored locally, analyzing an image after a refresh loads the classifier directly from local storage without downloading the model over the network, and releases any temporary loading memory once ready.
3. **Automatic Cleanup of Outdated Models**:
   - Verify that when local storage contains older models from previous Remote Config settings, initializing the classifier automatically deletes all outdated models while keeping the currently configured model.
4. **Hardware Fast-Fail Preservation**:
   - Verify that when GPU acceleration is unavailable for a GPU-only model, classification immediately returns `general` without accessing local model storage or the network, and that when GPU acceleration is available, hardware acceleration remains enabled when loading from local storage.
5. **Graceful Storage Fallback & Error Recovery**:
   - Verify that when local browser storage is unavailable, out of space, or encounters a failed download, the classifier avoids saving incomplete data and falls back to direct remote loading (or `general` if loading fails).
   - Verify that if classifier startup fails after reading the cached model, temporary loading memory is still released and the photo falls back to `general`.

## Out of Scope

- Adding user-facing "Cache Model", "Download Model", or "Clear Model Cache" buttons or progress bars in the **TTS Studio Workspace**.
- Caching multiple historical on-device classification models simultaneously or providing a user-facing model switcher dropdown.
- Modifying the **Asset Cache Manifest** for static application shell bundles.
- Pre-downloading the on-device classification model on the **Home Screen (Landing View)** before the user initiates **Image Analysis**.

## Further Notes

- Technical storage architecture, alternatives considered, and memory lifecycle details are documented in [ADR 0015: Persistent Browser Cache Storage and Automatic Eviction for On-Device Decision Model](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0015-persistent-browser-caching-for-on-device-decision-model.md) (extending [ADR 0014](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0014-on-device-image-classification-and-specialized-vision-routing.md)).
- All domain terminology conforms to [`GLOSSARY.md`](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/GLOSSARY.md) and respects the scope separation defined in [`docs/agents/document-boundaries.md`](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/agents/document-boundaries.md).
