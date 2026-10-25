---
name: Obsidian & Indigo AI
colors:
  surface: '#0f172a'
  surface-dim: '#090d16'
  surface-bright: '#1e293b'
  surface-container-lowest: '#0b1120'
  surface-container-low: '#111827'
  surface-container: '#1e293b'
  surface-container-high: '#334155'
  surface-container-highest: '#475569'
  on-surface: '#f1f5f9'
  on-surface-variant: '#94a3b8'
  inverse-surface: '#f8fafc'
  inverse-on-surface: '#0f172a'
  outline: '#334155'
  outline-variant: '#475569'
  surface-tint: '#6366f1'
  primary: '#4f46e5'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#e0e7ff'
  inverse-primary: '#a5b4fc'
  secondary: '#38bdf8'
  on-secondary: '#082f49'
  secondary-container: '#0369a1'
  on-secondary-container: '#e0f2fe'
  tertiary: '#34d399'
  on-tertiary: '#022c22'
  tertiary-container: '#047857'
  on-tertiary-container: '#d1fae5'
  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#7f1d1d'
  on-error-container: '#fecaca'
  background: '#0f172a'
  on-background: '#f1f5f9'
  surface-variant: '#1e293b'
typography:
  display-lg:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  title-md:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter, ui-sans-serif, system-ui, sans-serif
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  code-sm:
    fontFamily: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-max: 1152px
  gutter: 24px
---

## Brand & Aesthetic Principles

The **Firebase AI Logic Multimodal Speech Generator** is a focused AI studio web application. The visual language uses an **Obsidian & Electric Indigo** aesthetic: deep slate surfaces, subtle translucent borders, and focused high-contrast typography.

### Strict Architectural Constraints

- **Zero Extraneous Navigation**: Strictly NO top navigation bars, tabs, breadcrumbs, sidebars, avatars, or settings gear icons.
- **Strict Accessibility**: WCAG AA/AAA verified color contrast ratios.
- **Strict Performance**: `Inter` for UI, system monospace for telemetry/tokens, and zero external icon web fonts (inline SVGs only).

---

## Colors & Contrast Tokens

- **Background (`#0f172a` - Slate 900)**: Foundational deep canvas (`app-shell`).
- **Surface Cards (`#1e293b` - Slate 800 / 50% opacity)**: Floating structural panels with 1px border (`#334155`).
- **Primary Text (`#f1f5f9` - Slate 100)**: High-contrast body and titles.
- **Secondary Text (`#cbd5e1` - Slate 300)**: Generated body content, voice option labels, citations, and telemetry values.
- **Muted Text / Form Labels (`#94a3b8` - Slate 400)**: Secondary descriptions and uppercase tracked field labels.
- **Header Title Gradient**: Linear horizontal gradient from Indigo-400 (`#818cf8`) to Emerald-400 (`#34d399`).
- **Primary Action CTA (`#4f46e5` - Indigo 600)**: Full-width action buttons with `#6366f1` hover state and `#818cf8` accent highlights.
- **Accent Citations (`#818cf8` - Indigo 400)**: External link indicators for grounding sources, recommendation IDs, and obscure facts.
- **Error States (`#7f1d1d` bg, `#b91c1c` border, `#fecaca` text)**: Contextual alert boxes.

---

## Typography Architecture

1. **UI Text & Headings**: `Inter, ui-sans-serif, system-ui, sans-serif`
2. **Metadata & Token Counters**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
3. **No extra font downloads**: Preserves instant FCP, LCP, and zero CLS.

---

## Icons & Visual Assets

- **Inline SVGs only**: Zero third-party icon libraries or font packages.
- All icons (`PhotoIcon`, `MicIcon`, `CheckIcon`, `SpinnerIcon`, `ArrowDropDownIcon`, `ExternalLinkIcon`, `ArrowRightIcon`, `SignOutIcon`, `HomeIcon`) render as standalone Angular SVG components with `fill="currentColor"` or `stroke="currentColor"`.

---

## CSS Variables / Tailwind v4 `@theme static` (`src/styles.css`)

```css
@import 'tailwindcss';

@theme static {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --color-app-bg: #0f172a;
  --color-surface-card: rgba(30, 41, 59, 0.5);
  --color-surface-border: #334155;
  --color-surface-hover: #475569;

  --text-color-primary: #f1f5f9;
  --text-color-secondary: #cbd5e1;
  --text-color-muted: #94a3b8;

  --color-primary-indigo: #4f46e5;
  --color-primary-hover: #6366f1;
  --color-primary-accent: #818cf8;

  --color-error-bg: #7f1d1d;
  --color-error-border: #b91c1c;
  --color-error-text: #fecaca;
}

.error-block {
  @apply mt-6 bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg relative;
}

@utility section-wrapper {
  @apply w-full mt-6;
}

@utility section-title {
  @apply text-lg font-semibold text-primary mb-3;
}

@utility surface-card {
  @apply bg-surface-card p-4 rounded-lg border border-surface-border;
}

@utility empty-message {
  @apply text-center text-muted italic;
}

@utility btn-primary {
  @apply gap-2 text-white font-semibold py-3 px-4 rounded-lg bg-primary-indigo hover:bg-primary-hover disabled:bg-slate-600 disabled:cursor-not-allowed transition-all;
}

@utility app-icon {
  @apply inline-flex items-center justify-center shrink-0 w-5 h-5 select-none;
}

.form-field-label {
  @apply text-xs font-bold text-muted uppercase tracking-wider ml-1;
}
```

---

## Layout Hierarchy & Viewports

### Desktop Viewport (1280px+)

- **Outer Shell (`.app-shell`)**: `min-h-screen bg-app-bg text-primary font-sans flex flex-col items-center p-4 sm:p-6 lg:p-8`.
- **Inner Container (`.app-container`)**: Centered `max-w-6xl` (1152px) flex column.
- **Vertical Structure**:
  1. **Centered Header**: Title with Indigo-to-Emerald gradient, left-anchored Home button, and conditional right-anchored Sign-Out button.
  2. **2-Column Analyzer Grid (`gap-8`)**:
     - **Left Column**: Photo uploader/dropzone, suggested tag pills, Obscure Fact & Vocal Customization (Audio Tags) form (Scene, Emotion, Pace, Voice Profile combobox), and 3 speech playback buttons.
     - **Right Column**: Alternative text quote card, recommendations accordion list, and Search Grounding / Citations.
  3. **Bottom Telemetry & Thought**: Text Generation Token Usage & Image Optimization Metrics cards (`.usage-grid`) and Thought Summary box (`.thought-content` / `.surface-card overflow-y-auto h-64`).
  4. **Centered Rounded Footer (`.app-footer`)**: `bg-surface-card border border-surface-border rounded-2xl w-full text-center py-4 text-muted`.
  5. **Floating PWA Toast (`.pwa-banner`)**: Fixed at `bottom-6 right-6`.

### Mobile Viewport (<768px)

- Single-column linear stack with full-width touch targets (`p-4`), vertically ordered cards, and touch-optimized controls.

---

## Strict Component Specifications (Code Contract)

### 1. App Header (`HeaderComponent`)

- **Container (`.app-header`)**: Relative wrapper with centered text block (`relative flex items-center justify-center text-center mb-6 sm:mb-8 min-h-[4rem]`).
- **Shared Action Button (`.header-btn`)**:
  - Styling: `absolute top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover/60 focus:outline-none focus:ring-2 focus:ring-primary-hover active:scale-95 transition-all flex items-center justify-center`.
- **Home Navigation Action (`.header-btn left-0`)**:
  - Left-anchored link housing `<app-home-icon />` (`@apply app-icon`).
  - Accessible label: `aria-label="Go to Home Screen"`.
  - Target: `[routerLink]="homeLink"` (`/home`).
- **Sign Out Action (`.header-btn right-0`)**:
  - Right-anchored button rendered conditionally when `isAuthenticated()` is `true`.
  - Element: `<button type="button" class="header-btn right-0" aria-label="Sign out">` housing `<app-sign-out-icon />` (`@apply app-icon`).
  - Interaction: Signs out the user and redirects to the Home screen upon completion.
- **Title (`h1.header-title`)**: `"Firebase AI Logic Obscure Fact Speech Generator"` (`text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400 px-12`).
- **Constraints**: Strictly NO subtitles, secondary paragraphs, tabs, breadcrumbs, search bars, user avatars, or secondary dropdown menus. Only the designated left-anchored Home navigation button, right-anchored conditional Sign-Out button, and centered `h1` title are permitted.

### 2. App Footer (`FooterComponent`)

- **Container (`.app-footer`)**: Rounded floating card (`bg-surface-card border border-surface-border rounded-2xl w-full`).
- **Content (`.footer-content`)**: Centered text (`container mx-auto px-6 py-4 text-center text-muted text-sm`):
  - `© 2026 Image Analysis and Text-to-Speech Application.`
  - `Built with Angular, Firebase AI Logic, and TailwindCSS 4.`

### 3. PWA Update Notification Banner (`PwaUpdateBanner`)

- **Positioning & Card (`.pwa-banner`)**: `fixed bottom-6 right-6 bg-slate-800 text-primary p-4 rounded-lg shadow-2xl flex items-center gap-4 z-50 border border-surface-border`.
- **Message**: `"A new version is available!"` (`text-sm font-medium`).
- **Action Button (`.pwa-button`)**: `"Reload"` (`bg-primary-indigo hover:bg-primary-hover text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-all`).

### 4. Photo Picker & Dropzone (`PhotoPickerComponent`)

- **Dropzone Area (`.dropzone`)**: `w-full h-48 sm:h-64 md:h-80 border-2 border-dashed border-surface-border rounded-xl flex flex-col items-center justify-center text-muted hover:bg-surface-card hover:border-surface-hover focus-visible:ring-2 focus-visible:ring-primary-accent focus-visible:outline-hidden transition-colors cursor-pointer p-4`.
- **Drag-Active State (`.dropzone.drag-active`)**: `bg-surface-hover border-primary-indigo text-primary-accent scale-102 shadow-indigo-500/20 shadow-md`.
- **Icons & Text**: Centered camera/photo SVG icon (`.photo-icon`: `w-12 h-12 sm:w-16 sm:h-16 text-muted`), `.upload-title` (`mt-2 sm:mt-4 text-sm sm:text-base font-semibold text-primary`), `.upload-subtitle` (`text-xs sm:text-sm text-muted`).
- **Preview State (`.preview-image`)**: Rounded image thumbnail (`w-full h-auto max-h-96 object-contain rounded-xl shadow-lg`) with floating `"Change Image"` action overlay (`.btn-image-selector`: `bg-app-bg/50 text-primary px-3 py-1.5 text-sm rounded-md hover:bg-app-bg/80`).
- **Action CTA (`.btn-generate`)**: Full-width primary button (`@apply btn-primary`) **"Analyze Image"** with animated SVG loading spinner.

### 5. Suggested Tags Display (`TagsDisplayComponent`)

- **Container**: Horizontal wrapping tag row (`flex flex-wrap gap-2`).
- **Pill Badges (`.tag-pill`)**: `bg-indigo-900/20 text-indigo-200 border border-indigo-500/30 text-sm font-medium px-3 py-1 rounded-full`, with active highlight state (`.tag-pill-selected`: `bg-primary-indigo text-white border-indigo-400 shadow-md shadow-indigo-500/20`).

### 6. Vocal Customization (Audio Tags) & Voice Profile Selector (`SpeechStudioComponent` & `VoiceSelectorComponent`)

- **Obscure Fact Heading (`.section-title`)**: `"A surprising or obscure fact about the tags"` (`@apply section-title`).
- **Obscure Fact Text (`.obscure-fact-text`)**: `text-primary-accent italic mb-4 text-lg`.
- **Customizer Container (`.audio-customize-container`)**: `bg-surface-card backdrop-blur-sm p-6 rounded-xl border border-surface-border shadow-xl mb-6`.
- **Form Inputs (`.form-field-textarea`)**: Scene (textarea), Emotion (input), and Pace (input) styled with `w-full bg-slate-900/60 border border-surface-border rounded-lg px-4 py-2 text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all`.
- **Field Labels (`.form-field-label`)**: `text-xs font-bold text-muted uppercase tracking-wider ml-1`.
- **Voice Profile Selector (`VoiceSelectorComponent`)**: Accessible `@angular/aria` combobox (`.form-field-select .voice-trigger`), popup listbox (`.voice-popup-container`: `bg-slate-900 border border-surface-border`), microphone/caret/check icons (`text-primary-accent`), and 6 Voice Profiles (`Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`) rendered in `text-secondary`.

### 7. Speech Generation Controls (`SpeechStudioComponent`)

- **Trigger Buttons Container**: `flex justify-evenly gap-4`.
- **Audio Buttons (`.btn-audio`)**: `mt-6 flex items-center justify-center px-4 py-2 btn-primary shadow-md`.
- **Button Labels & Icons (Strict Code Contract)**:
  - 1. `"Play Speech (Sync)"`
  - 2. `"Play Speech (Stream)"`
  - 3. `"Web Audio API"`
  - **STRICT**: Buttons contain ONLY button text and an animated SVG loading spinner (`animate-spin h-5 w-5`) when `isLoading` is true. Strictly NO play icons (▶), NO speaker icons (🔊), NO waveform icons.
- **Audio Output Figure (`.playback-figure`)**:
  - Rendered conditionally when `audioUrl` is present:
  - Container: `mt-6 p-4 bg-slate-900/40 border border-surface-border rounded-xl flex flex-col gap-2`.
  - Caption (`.playback-caption`): `"Listen to the Gemini-TTS:"` (`text-sm font-medium text-muted`).
  - Audio Element: Standard native `<audio controls>` player (`w-full outline-none`).

### 8. Alternative Text Card (`AltTextPanelComponent`)

- **Section Wrapper (`.section-wrapper`)**: `w-full mt-6`.
- **Heading (`.section-title`)**: `"Generated Alternative Text"` (`text-lg font-semibold text-primary mb-3`).
- **Card (`.surface-card`)**: Rounded container (`bg-surface-card p-4 rounded-lg border border-surface-border`).
- **Content (`.display-text`)**: Quoted generated alt-text string in `text-secondary italic` (`"..."`).
- **STRICT Constraint**: Strictly NO model badges (e.g. "Gemini 1.5 Pro"), NO label badges, and NO pill indicators.

### 9. Recommendations Accordion (`RecommendationsComponent`)

- **Heading (`.section-title`)**: Strictly `"Recommendations"` (`text-lg font-semibold text-primary mb-3`).
- **Accordion List (`ngAccordionGroup`)**: Multi-expandable group (`flex flex-col gap-3`, `[multiExpandable]="true"`).
- **Item Card (`.recommendation-card`)**: `bg-indigo-900/10 border border-indigo-500/20 text-sm font-medium p-4 rounded-lg text-secondary w-full transition-all duration-300 hover:border-indigo-500/40`.
- **Item Trigger (`.recommendation-trigger`)**:
  - Contains ID and title: `<span class="recommendation-id font-bold">{{ item.id }}: </span> <span class="recommendation-text">{{ item.text }}</span>` (`text-primary-accent` and `text-primary`).
  - Right-aligned rotating SVG chevron icon (`.expand-icon`: `w-5 h-5 text-primary-accent transition-transform duration-200 flex-shrink-0`, `.expand-icon__expanded`: `rotate-180 text-indigo-300`).
  - **STRICT**: Strictly NO status badges, NO confidence pills (e.g. "HIGH CONFIDENCE", "SYNTH READY", "Optimal").
- **Expanded Panel (`ngAccordionPanel`)**:
  - Detailed explanation formatted as `<span class="recommendation-reason-label">Reason:</span> <span class="recommendation-reason-text">{{ item.reason }}</span>` (`text-primary-accent/80` and `text-muted text-xs italic`).

### 10. Search Grounding / Citations (`GroundingComponent`)

- **Container (`.section-wrapper`)**: Full-width section (`w-full mt-6`).
- **Inline Citations Block** (when `citations` present):
  - **Heading (`.section-title`)**: `"Inline Citations"` (`text-lg font-semibold text-primary mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="ordered-list">` (`list-decimal mb-3`) with numbered list items (`<li class="ml-4 list-item">` in `text-secondary`).
  - **Link Anchor (`.link-anchor`)**: `<a class="text-primary-accent hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">{{ citation.title }}</a>`.
- **Search Queries Block** (when `searchQueries` present):
  - **Heading (`.section-title`)**: `"Search Queries"` (`text-lg font-semibold text-primary mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="ordered-list">` with `<li class="ml-4 list-item"><span class="italic">{{ query }}</span></li>`.
- **Google Search Suggestions Block** (when `safeRenderedContent` present):
  - **Heading (`.section-title`)**: `"Google Search Suggestions"` (`text-lg font-semibold text-primary mb-3`).
  - Rendered search suggestion HTML container (`.grounding-suggestions`).
- **STRICT Constraint**: Zero artificial dashboard metric badges (e.g. NO "3 verified links", NO "0.94 score", NO chip grids). Structured as clean ordered lists with title-case headings.

### 11. Usage & Image Optimization Metrics (`AppUsageMetricsComponent` & `ThoughtSummaryComponent`)

- **Telemetry Container (`.metrics-container`)**:
  - Full-width wrapper with responsive layout (`flex flex-col md:flex-row gap-4 mt-6`).
- **Telemetry Card Surface (`.metrics-card`)**:
  - Surface card (`bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex-1`).
- **Text Generation Token Usage Card**:
  - **Heading (`.section-title`)**: `"Text Generation Token Usage"` (`text-lg font-semibold text-primary mb-3`).
  - **Container (`.usage-grid`)**: Responsive statistics row (`flex flex-wrap justify-around gap-2`).
  - **Items (`.usage-item`)**: 4 statistics formatted as `text-secondary italic font-mono text-sm tracking-wide`:
    - `Input: 412`
    - `Output: 168`
    - `Thought: 84`
    - `Total: 664`
- **Image Optimization Efficiency Card** (when `optimizationMetrics` present):
  - **Heading (`.section-title`)**: `"Image Optimization Efficiency"` (`text-lg font-semibold text-primary mb-3`).
  - **Container (`.usage-grid`)**: Responsive statistics row (`flex flex-wrap justify-around gap-2`).
  - **Items (`.usage-item`)**: Statistics formatted as `text-secondary italic font-mono text-sm tracking-wide`:
    - `Original Size: 4.8 MB`
    - `Optimized Size: 56 KB`
    - `Payload Saved: 98.8%`
    - `Tokens Saved: ~5,934`
- **Thought Summary (`ThoughtSummaryComponent`)**:
  - **Heading (`.section-title`)**: `"Thought Summary"` (`text-lg font-semibold text-primary mb-3`).
  - **Content Container (`.thought-content` / `.surface-card overflow-y-auto h-64`)**: Scrollable surface card (`bg-surface-card p-4 rounded-lg border border-surface-border overflow-y-auto h-64`).
  - **Content Text (`.thought-text`)**: Markdown HTML rendered in `text-secondary italic`.
- **STRICT Constraint**: Zero artificial neon badges, circular progress meters, or status chips. Clean key-value telemetry adhering strictly to the Obsidian & Indigo theme tokens.

---

### 12. Home Screen (`HomeComponent`)

- **Outer Wrapper (`.home-container`)**: Centered layout inside standard `.app-main` (`w-full flex-1 flex flex-col items-center justify-center py-8 sm:py-16`).
- **Hero Card (`.home-card.surface-card`)**:
  - **Desktop Viewport (1280px+)**: Floating surface card (`bg-surface-card border border-surface-border rounded-2xl max-w-2xl w-full p-6 sm:p-12 text-center flex flex-col items-center gap-6 shadow-2xl backdrop-blur-sm`).
  - **Mobile Viewport (<768px)**: Full-width responsive card (`p-6 w-full flex flex-col items-center gap-6`).
- **Category Pill (`.home-badge`)**: `"Firebase AI Logic & Vertex AI"` (`text-xs uppercase font-bold tracking-widest text-primary-accent bg-indigo-950/60 border border-indigo-800/60 px-3 py-1 rounded-full`).
- **Headline (`.home-title`)**: `"Multimodal Vision & Real-Time Speech Studio"` (`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-primary`).
- **Description (`.home-description`)**: `"Analyze images with Gemini multimodal intelligence, discover grounded obscure facts, and generate real-time streaming audio with customizable voice personas."` (`text-sm sm:text-base text-muted max-w-lg leading-relaxed`).
- **Primary Dynamic Hero CTA Button (`.btn-primary.btn-launch`)**:
  - **Authenticated State**:
    - Semantic link to Studio dashboard (`[routerLink]="dashboard"`).
    - Content: `"Launch Studio"` label accompanied by standalone `<app-arrow-right-icon>` (`ArrowRightIconComponent`, `aria-hidden="true"`) with micro-interaction hover translation (`group-hover:translate-x-1`).
    - Styling: `class="btn-primary btn-launch group"` (`@apply px-8 py-3.5 text-base shadow-lg shadow-indigo-500/20 flex items-center justify-center;`).
  - **Unauthenticated State**:
    - Primary action button triggering the Sign-In Modal dialog.
    - Content: `"Sign In"` label with interactive hover and focus states (strictly NO right arrow icon).
    - Styling: `class="btn-primary btn-launch"` (`@apply px-8 py-3.5 text-base shadow-lg shadow-indigo-500/20 flex items-center justify-center;`).
- **Architecture & Capabilities Metadata Grid (`.home-features-grid`)**:
  - Container: `w-full grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-6 border-t border-surface-border/60 mt-2`.
  - Feature Cards (`.feature-item`): `bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col items-center gap-1 text-center` with `.feature-label` (`text-xs font-medium text-muted uppercase tracking-wider`) and `.feature-value` (`text-sm font-semibold text-secondary`).
  - Clean key-value list with **zero status pills or badge chips**:
    - **Model Pipeline**: `Gemini 3.8 Flash`
    - **Audio Synthesis**: `Gemini-TTS Streaming`
    - **Grounding**: `Google Search Tool`
- **Strict Constraints**:
  - Strictly NO right arrow icon or secondary icons on the unauthenticated `"Sign In"` CTA button (the arrow icon is strictly reserved for the authenticated `"Launch Studio"` button).
  - Strictly NO status pills, badges, or chip tags on list items (`Multimodal`, `Real-Time`, `Verified` tags are forbidden).
  - Strictly NO obsolete model names (must use modern `Gemini 3.8 Flash`).
  - Strictly NO isolated `min-h-screen` or independent background overrides; must seamlessly inherit `.app-shell` and `.app-container`.
  - Strictly NO marketing carousels, unstyled external links, or secondary sidebar menus.

---

### 13. Sign-In Modal Dialog (`SignInModalComponent`)

- **Overlay & Backdrop**:
  - Centered modal container over a semi-transparent blurred backdrop (`backdrop-blur-sm bg-black/40`).
- **Modal Card Surface (`.modal-card`)**:
  - Geometry: `rounded-2xl bg-surface-card border border-surface-border p-6 sm:p-8 max-w-md w-full shadow-2xl backdrop-blur-md flex flex-col gap-5`.
- **Header (`.modal-header`)**:
  - Layout: `flex items-center justify-between pb-2 border-b border-surface-border/60`.
  - Title (`#sign-in-dialog-title.modal-title`): `"Sign In"` (`text-xl sm:text-2xl font-bold text-primary`).
  - Close Button (`.modal-close-btn`): Top-right button (`p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-hover/60 focus:outline-none focus:ring-2 focus:ring-primary-hover transition-all flex items-center justify-center`) with `aria-label="Close dialog"`.
- **Form Fields & Validation**:
  - **Email Field**:
    - Label (`.form-label`): `"Email Address"` (`text-xs uppercase font-semibold tracking-wider text-muted mb-1.5 block`).
    - Input (`.form-input`): `<input type="email" autocomplete="username">` (`w-full bg-app-bg border border-surface-border text-primary rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-hover transition-all`).
    - Validation Hint (`.error-hint`): Rendered below touched invalid field in `text-xs mt-1 block text-error-text`.
  - **Password Field**:
    - Label (`.form-label`): `"Password"` (`text-xs uppercase font-semibold tracking-wider text-muted mb-1.5 block`).
    - Input (`.form-input`): `<input type="password" autocomplete="current-password">` (`w-full bg-app-bg border border-surface-border text-primary rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-hover transition-all`).
    - Validation Hint (`.error-hint`): Rendered below touched invalid field in `text-xs mt-1 block text-error-text`.
  - **Error Alert Banner (`.error-block`)**:
    - Rendered conditionally on failed sign-in attempts: `@apply mt-2 mb-2 text-sm` inheriting global `.error-block` (`bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg relative`).
- **Submit Action (`.btn-submit`)**:
  - Submit Button (`.btn-submit`): Primary button **"Sign In"** (`@apply btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2`).
  - Loading State: Animated SVG spinner (`svgClass="animate-spin h-5 w-5"`) rendered when `signInForm().submitting()` is `true`, disabling further submissions.
- **Accessibility & Focus Contract**:
  - ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="sign-in-dialog-title"`.
  - Traps keyboard focus within the dialog while open.
  - Autofocuses the Email input upon opening.
  - Pressing `Escape` or clicking the backdrop dismisses the dialog without side-effects.
- **Strict Constraints**:
  - Strictly NO third-party SSO buttons, badges, or provider links (e.g. Google, GitHub, Apple).
  - Strictly NO "Forgot Password?" or password reset recovery links/flows.
  - Strictly NO "Sign Up" / "Create Account" registration links, toggles, or secondary modes.
  - Strictly NO biometric, WebAuthn, or Passkey options.
  - Strictly NO secondary marketing footers, terms/privacy links, or external badges inside the dialog. Only the designated Header (Title + Close 'X' button), conditional Error block, Email field, Password field, and Primary "Sign In" button are permitted.
