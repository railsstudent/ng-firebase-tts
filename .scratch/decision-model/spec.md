# Specification: On-Device Image Classification & Specialized Vision Routing

**Status**: `ready-for-agent`

## Problem Statement

When users upload photos to the TTS Studio Workspace, every image is currently analyzed by a single general-purpose Gemini vision prompt configured only with Google Search grounding. This one-size-fits-all approach produces suboptimal **Image Analysis** results for two critical subject categories:

1. **People and Faces**: When an uploaded photo features a person or face, the generated alternative text is generic—it fails to recognize notable public figures and provides shallow descriptions when the subject is an unknown person rather than detailing facial expressions, gaze, posture, attire, framing, and lighting.
2. **Places and Landmarks**: When an uploaded photo features a landmark, building, or recognizable location, the generated alternative text omits the canonical place name and geographic coordinates (latitude and longitude) and lacks Google Maps geospatial grounding and source attribution.

Calling a cloud generative model twice (once to classify the image and once to generate the specialized analysis) would double network latency and cloud token usage.

## Solution

Introduce **On-Device Image Classification** in the browser to classify the preprocessed image into an **Image Subject Category** (`people`, `place`, or `general`) before dispatching the cloud Gemini request:

1. Evaluate the downscaled, compressed image locally against three mutually exclusive subject categories (`place`, `people`, `general`), selecting the category with the highest probability and giving outdoor landscapes, architecture, monuments, landmarks, and travel destinations precedence over foreground human subjects (so a selfie in front of a landmark is routed as `place`). If hardware acceleration is unavailable for the configured model or loading/evaluation fails, seamlessly fall back to `general`.
2. Route **`people`** images to a portrait-specialized Gemini model that identifies recognizable public figures by name and context, or describes rich human-centric visual features (facial expression, emotion, gaze, pose, attire, framing, and lighting) when the person cannot be identified.
3. Route **`place`** images to a location-specialized Gemini model (grounded with both Google Maps and Google Search) that weaves the **Place Name** and **Latitude / Longitude** coordinates directly into the alternative text while grounding the interconnecting **Obscure Fact** via Google Search.
4. Route **`general`** images to the existing general-purpose Gemini vision model.
5. Display the detected **Image Subject Category** as a styled badge next to the generated alternative text header, and display **Place Grounding / Maps Citations** with compliant Google Maps attribution in the grounding panel whenever Google Maps sources are returned.

## User Stories

1. As a user uploading a portrait of a recognizable public figure or celebrity, I want the generated alternative text to identify the person by name and notable context, so that my alternative text is accurate and informative.
2. As a user uploading a photo of an everyday or private person whose identity is unknown, I want the model to avoid guessing a name and instead describe facial expressions, emotions, gaze direction, posture, attire, framing, and lighting, so that the alternative text remains vivid, respectful, and accessible.
3. As a user uploading a photo of a famous landmark or recognizable place, I want the generated alternative text to explicitly include the place name and its latitude and longitude coordinates alongside visual architectural details, so that readers and screen-reader users know the exact location.
4. As a user uploading a photo of a generic street or unidentifiable building where exact coordinates cannot be verified, I want the place model to describe the architectural style and likely setting without fabricating coordinates, so that the alternative text stays trustworthy.
5. As a traveler uploading a selfie in front of a recognizable landmark, I want the classifier to prioritize the `place` category over `people`, so that the landmark's place name and coordinates are included in the alternative text.
6. As a user uploading a photo of a place, I want the model to use both Google Maps grounding (for accurate place identification and location context) and Google Search grounding (for discovering a surprising **Obscure Fact** interconnecting the tags), so that both the location details and the trivia narration remain rich and verified.
7. As a user uploading a photo of a place worldwide, I want Google Maps grounding to match the landmark globally based on the image rather than prompting for my browser's local GPS coordinates, so that I am never interrupted by geolocation permission dialogs or biased toward my current city.
8. As a user viewing the analysis results of a place photo grounded by Google Maps, I want to see the **Place Grounding / Maps Citations** listed in the grounding section with links to Google Maps and compliant `Google Maps` attribution, so that I can verify and explore the referenced location.
9. As a user uploading an image of an object, animal, food item, or abstract scene, I want the classifier to select the `general` category and use the existing general vision model, so that non-person, non-place images continue working as before.
10. As a user or blog reader inspecting the generated alternative text panel, I want to see a visual category badge (`place`, `people`, or `general`) next to the alternative text heading, so that I can immediately tell which specialized model pipeline analyzed the image.
11. As a user on a browser or device without GPU acceleration, I want the application to skip unusable GPU-only model downloads and automatically fall back to a CPU-compatible classifier or the `general` vision model without throwing an error, so that **Image Analysis** always succeeds without wasted downloads.
12. As a performance-conscious user, I want the on-device classifier to reuse the already-downscaled and compressed image produced during **Vision Payload Preprocessing**, so that my browser does not decode the multi-megapixel upload twice.
13. As a visitor loading the application, I want the on-device classifier runtime files to be served locally from the application host and cached lazily only when image analysis runs, so that the initial page load and startup bundle size remain completely unaffected.
14. As an application administrator, I want the on-device model URL to be configurable via Firebase Remote Config with local defaults, so that I can switch models without redeploying code.
15. As a user clicking "Generate" on consecutive photos, I want both the warmed-up on-device classifier and the category-specific cloud models to be reused across requests, so that subsequent analyses run with minimal overhead.

## Implementation Decisions

The technical architecture and trade-offs are governed by [ADR 0014: On-Device Image Classification with MediaPipe Decision Maker and Specialized Vision Routing](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0014-on-device-image-classification-and-specialized-vision-routing.md).

### 1. Image Subject Categories & Classification Rules

- Every uploaded photo is classified on-device into one of three mutually exclusive **Image Subject Categories** by selecting the category with the highest probability before cloud analysis begins:
  - **`place`**: Outdoor landscapes, natural scenery, architecture, monuments, landmarks, and travel destinations—even when people appear in the foreground (such as a tourist sitting in front of a monument).
  - **`people`**: Portraits, close-up faces, individual subjects, or groups of people.
  - **`general`**: Close-up scenes of single everyday items, creatures, meals, or text graphics.
- The classifier evaluates the already-downscaled and compressed image produced during **Vision Payload Preprocessing** so the browser never decodes the original high-resolution upload twice.

### 2. Hardware Acceleration, Fallback & Error Recovery Behavior

- **Hardware Selection**:
  - When the user's browser and device support GPU acceleration, on-device classification runs on the GPU for fast local inference.
  - When GPU acceleration is unavailable on the device:
    - If the configured on-device model requires a GPU to run, the application skips downloading the model entirely and immediately routes the image to the **`general`** vision model so the user never waits for an unusable download.
    - If a CPU-compatible on-device model is configured via Remote Config, the classifier runs on the CPU instead.
- **Error Fallback**:
  - If loading the on-device classifier fails (for example, due to a temporary network interruption), the current photo seamlessly falls back to the **`general`** vision model and the next photo upload retries loading the classifier.
  - If classifying an individual photo fails after the classifier is already loaded, that photo falls back to the **`general`** vision model while keeping the loaded classifier ready for subsequent photos.

### 3. Specialized Vision Routing Behavior

- **`people` Route**:
  - Uses a portrait-focused instruction and prompt with Google Search grounding.
  - Identifies a person by name only when their name is explicitly printed in visible text inside the image (such as a promotional poster, banner, or broadcast graphic) or when their unmasked face is 100% unmistakable directly from visual recognition without needing a web search. Never uses text-based Google Search to guess or deduce a person's or masked performer's identity from visual descriptions.
  - Uses Google Search strictly to verify visible text clues (organization logos, event names, championship titles) and to discover the interconnecting **Obscure Fact**.
  - When a person's identity is not explicitly printed or 100% unmistakable, avoids guessing a name and instead describes observable human details: facial expression or mask design, emotion, gaze direction, posture or action, attire and accessories, framing, and lighting.
- **`place` Route**:
  - Uses a location-focused instruction and prompt with both Google Maps grounding (for global landmark and coordinate lookup without requesting browser GPS permissions) and Google Search grounding (for finding the interconnecting **Obscure Fact**).
  - Weaves the official **Place Name** and **Latitude / Longitude** coordinates naturally into the generated alternative text alongside architectural and geographic details (and describes the presence, pose, and attire of any foreground traveler without guessing their identity), without fabricating coordinates when a location cannot be verified.
- **`general` Route**:
  - Uses the general-purpose prompt (with the same guardrail against guessing person names via Google Search) and Google Search grounding to generate alternative text, tags, recommendations, and an interconnecting **Obscure Fact**.

### 4. User Interface Behavior

- **Image Subject Category Badge**: Displays a pill badge (`place`, `people`, or `general`) next to the _"Generated Alternative Text"_ heading so the user can see which specialized pipeline analyzed the photo.
- **Google Maps Sources & Attribution**: When a place analysis returns **Place Grounding / Maps Citations**, the grounding panel displays a **Google Maps Sources** numbered list linking each place title to Google Maps, accompanied by a non-translated `Google Maps` attribution label.

## Testing Decisions

1. **Image Preprocessing & Reuse**:
   - Verify that preprocessing an uploaded photo produces the compressed image bytes needed for on-device classification alongside the cloud upload payload, both when browser canvas compression succeeds and when it falls back to the original file.
2. **On-Device Classification & Fallback**:
   - Verify that photos of places, people, and everyday items are classified into `place`, `people`, and `general` respectively by selecting the category with the highest probability once the classifier is warmed up, and that subsequent photos reuse the warmed-up classifier.
   - Verify that when GPU acceleration is unavailable, GPU-only models are skipped immediately without downloading weights (routing to `general`), whereas CPU-compatible models run on the CPU.
   - Verify that temporary classifier loading errors fall back to `general` and retry on the next photo, while single-photo classification errors fall back to `general` without discarding the warmed-up classifier.
3. **Specialized Vision Routing & Place Citations**:
   - Verify that `people`, `place`, and `general` classifications route to their respective prompts and grounding tools, attach the detected category to the analysis result, and extract Google Maps place links when returned by a `place` analysis.
4. **Alternative Text Badge & Grounding Display**:
   - Verify that the alternative text header displays the category badge when a category is present and omits it when absent.
   - Verify that the grounding panel displays the **Google Maps Sources** list and `Google Maps` attribution when place citations are present and hides the section when none exist.

## Out of Scope

- Requesting browser geolocation permissions or biasing landmark detection to the user's current physical location.
- Embedded interactive Google Maps widgets or map canvases.
- Biometric face recognition of private individuals or custom face-recognition databases.
- Adding separate coordinate fields outside the generated alternative text.

## Further Notes

- Technical architecture, library choices, and trade-offs are documented in [ADR 0014: On-Device Image Classification with MediaPipe Decision Maker and Specialized Vision Routing](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/docs/adr/0014-on-device-image-classification-and-specialized-vision-routing.md).
- Concrete engineering tasks and Red -> Green unit test suites are broken down into 9 implementation tickets under `.scratch/decision-model/issues/`.
- All domain terminology conforms to [`GLOSSARY.md`](file:///Users/connieleung/Documents/ws_jsangular2/ng-firebase-tts/GLOSSARY.md).
