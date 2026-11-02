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

@utility section-title {
  @apply text-lg font-semibold text-primary mb-3;
}

@utility surface-card {
  @apply bg-surface-card p-4 rounded-lg border border-surface-border;
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

- **Container (`.header-card`)**: Relative wrapper with centered text block (`relative flex items-center justify-center text-center mb-6 sm:mb-8 min-h-[4rem]`).
- **Shared Action Button (`.header-btn`)**:
  - Styling: `absolute top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover/60 focus:outline-none focus:ring-2 focus:ring-primary-hover active:scale-95 transition-all flex items-center justify-center`.
- **Home Navigation Action (`.header-btn left-0`)**:
  - Left-anchored link housing `<app-home-icon />` (`host: { class: 'app-icon w-6 h-6' }`).
  - Accessible label: `aria-label="Go to Home Screen"`.
  - Target: `[routerLink]="homeLink"` (`/home`).
- **Sign Out Action (`.header-btn right-0`)**:
  - Right-anchored button rendered conditionally when `isAuthenticated()` is `true`.
  - Element: `<button type="button" class="header-btn right-0" aria-label="Sign out">` housing `<app-sign-out-icon />` (`host: { class: 'app-icon w-6 h-6' }`).
  - Interaction: Signs out the user and redirects to the Home screen upon completion.
- **Title (`h1.header-title`)**: `"Firebase AI Logic Obscure Fact Speech Generator"` (`text-xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-accent to-emerald-400 px-12`).
- **Constraints**: Strictly NO subtitles, secondary paragraphs, tabs, breadcrumbs, search bars, user avatars, or secondary dropdown menus. Only the designated left-anchored Home navigation button, right-anchored conditional Sign-Out button, and centered `h1` title are permitted.

### 2. App Footer (`FooterComponent`)

- **Container (`footer.surface-card.footer-card.text-muted`)**: Rounded surface card (`bg-surface-card p-4 rounded-xl border border-surface-border px-6 text-center text-sm text-muted`).
- **Content**: Centered text:
  - `© 2026 Image Analysis and Text-to-Speech Application.`
  - `Built with Angular, Firebase AI Logic, and TailwindCSS 4.`

### 3. PWA Update Notification Banner (`PwaUpdateBannerComponent`)

- **Positioning & Card (`.pwa-banner border text-sm`)**: `fixed bottom-6 right-6 bg-app-bg text-primary p-4 flex items-center gap-4 z-50 rounded-lg border-surface-border` (with `border text-sm` in HTML).
- **Message**: `"A new version is available!"` (`font-medium`).
- **Action Button (`.pwa-button font-semibold rounded-md`)**: `"Reload"` (`bg-primary-indigo hover:bg-primary-hover px-3 py-1.5 transition-all` with `font-semibold rounded-md` in HTML).

### 4. Photo Picker & Dropzone (`PhotoPickerComponent`)

- **Dropzone Area (`.dropzone border-2 border-dashed`)**: `w-full rounded-xl h-48 sm:h-64 md:h-80 flex flex-col items-center justify-center focus-visible:border-primary-accent transition-colors cursor-pointer p-4` combined with `@let normalClasses = 'outline-none border-surface-border text-muted hover:bg-surface-card hover:border-surface-hover'`.
- **Drag-Active State (`dragClasses`)**: `outline-none bg-surface-hover border-primary-indigo text-primary-accent scale-102`.
- **Icons & Text**: Centered camera/photo SVG icon (`<app-photo-icon />`: `app-icon w-12 h-12 sm:w-16 sm:h-16 pointer-events-none text-muted`), upload title (`mt-2 text-primary pointer-events-none font-semibold`), and upload subtitle (`pointer-events-none text-xs sm:text-sm`).
- **Preview State (`.preview-image border-2 border-surface-border`)**: Rounded image thumbnail (`w-full max-h-96 object-contain rounded-xl`) with floating action overlay (`grid absolute top-3 right-6`) containing `"Change Image"` and `"Remove Image"` buttons (`.btn-image-selector`: `bg-app-bg text-primary px-3 py-1.5 text-sm rounded-md hover:bg-surface-hover transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100` plus `focus-visible:outline-2 focus-visible:outline-primary-accent` in HTML).
- **Action CTA (`w-full btn-primary mt-6`)**: Full-width primary button **"Generate Description"** (or **"Analyzing..."** with `<app-spinner-icon class="w-5 h-5" />`).

### 5. Suggested Tags Display (`TagsDisplayComponent`)

- **Container**: Horizontal wrapping tag row (`flex flex-wrap gap-2`).
- **Pill Badges (`.tag-pill border font-medium`)**: `bg-app-bg text-primary-accent border-primary-indigo text-sm px-3 py-1 rounded-full`, with active highlight state (`.tag-pill-selected, .tag-option[aria-selected='true'] .tag-pill`: `bg-primary-indigo text-primary border-primary-accent`).

### 6. Vocal Customization (Audio Tags) & Voice Profile Selector (`SpeechStudioComponent` & `VoiceSelectorComponent`)

- **Obscure Fact Heading (`.section-title`)**: `"A surprising or obscure fact about the tags"` (`@apply section-title`).
- **Obscure Fact Text (`.obscure-fact-text mb-4 text-lg`)**: `text-primary-accent italic`.
- **Customizer Container (`surface-card p-6 mb-6`)**: Uses global `surface-card` utility with `p-6 mb-6`.
- **Form Inputs (`form-input`)**: Scene (textarea), Emotion (input), and Pace (input) styled with global `@utility form-input` (`border border-surface-border text-primary rounded-lg focus:outline-none focus:border-primary-hover transition-all p-4 placeholder:text-muted w-full bg-app-bg`).
- **Field Labels (`.form-field-label`)**: `text-xs font-bold text-muted ml-1`.
- **Voice Profile Selector (`VoiceSelectorComponent`)**: Accessible `@angular/aria` combobox (`form-input voice-trigger justify-between` where `.voice-trigger` applies `cursor-pointer flex items-center select-none`), popup listbox (`.voice-popup-container border border-surface-border outline-none` where `.voice-popup-container` applies `w-full bg-app-bg rounded-xl mt-1 max-h-56 p-1.5 overflow-y-auto z-50`), option items styled via `[ngOption]` (`px-3 py-2 rounded-lg text-secondary cursor-pointer transition-colors text-sm select-none`), `[ngOption]:hover, [ngOption][data-active='true']` (`bg-surface-card text-primary-accent`), and `[ngOption][aria-selected='true']` (`bg-primary-indigo text-primary`), microphone/caret/check icons, and 6 Voice Profiles (`Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`).

### 7. Speech Generation Controls (`SpeechStudioComponent`)

- **Trigger Buttons Container**: `flex justify-evenly gap-4`.
- **Audio Buttons (`mt-6 btn-primary shadow-md`)**: Uses global `btn-primary` with `mt-6 shadow-md`.
- **Button Labels & Icons (Strict Code Contract)**:
  - 1. `"Play Speech (Sync)"`
  - 2. `"Play Speech (Stream)"`
  - 3. `"Web Audio API"`
  - **STRICT**: Buttons contain ONLY button text and an animated SVG loading spinner (`<app-spinner-icon class="w-5 h-5" />`) when `isLoading` is true. Strictly NO play icons (▶), NO speaker icons (🔊), NO waveform icons.
- **Audio Output Figure (`.playback-figure border bg-app-bg`)**:
  - Rendered conditionally when `audioUrl` is present:
  - Container: `mt-6 p-4 rounded-xl border-surface-border flex flex-col gap-2` (with `border bg-app-bg` in HTML).
  - Caption: `"Listen to the Gemini-TTS:"` (`text-sm font-medium text-muted`).
  - Audio Element: Standard native `<audio controls>` player (`w-full outline-none`).

### 8. Alternative Text Card (`AltTextPanelComponent`)

- **Section Wrapper**: `w-full mt-6`.
- **Heading (`.section-title`)**: `"Generated Alternative Text"` (`text-lg font-semibold text-primary mb-3`).
- **Card (`.surface-card`)**: Rounded container (`bg-surface-card p-4 rounded-xl border border-surface-border`).
- **Content**: Quoted generated alt-text string in `text-secondary italic` (`"..."`).
- **STRICT Constraint**: Strictly NO model badges (e.g. "Gemini 1.5 Pro"), NO label badges, and NO pill indicators.

### 9. Recommendations Accordion (`RecommendationsComponent`)

- **Heading (`.section-title`)**: Strictly `"Recommendations"` (`text-lg font-semibold text-primary mb-3`).
- **Accordion List (`ngAccordionGroup`)**: Multi-expandable group (`flex flex-col gap-3`, `[multiExpandable]="true"`).
- **Item Card (`surface-card recommendation-card font-medium`)**: Combines `surface-card` with `.recommendation-card` (`bg-app-bg text-sm text-secondary w-full transition-all hover:border-primary-indigo`).
- **Item Trigger (`.recommendation-trigger focus-visible:outline-2 focus-visible:outline-primary-accent`)**:
  - Styling: `flex items-center justify-between cursor-pointer rounded w-full py-1`.
  - Contains ID and title: `<span class="text-primary-accent font-bold">{{ item.id }}: </span> <span class="text-primary">{{ item.text }}</span>`.
  - Right-aligned rotating SVG chevron icon (`<app-expand-more-icon class="transition-transform" [class]="triggerRef.expanded() ? 'rotate-180 text-primary' : 'text-primary-accent'" />`).
  - **STRICT**: Strictly NO status badges, NO confidence pills (e.g. "HIGH CONFIDENCE", "SYNTH READY", "Optimal").
- **Expanded Panel (`ngAccordionPanel`)**:
  - Detailed explanation formatted as `<span class="block mt-2 text-primary-accent/80">REASON:</span> <span class="text-muted block italic mt-0.5">{{ item.reason }}</span>`.

### 10. Search Grounding / Citations (`GroundingComponent`)

- **Container**: Full-width section (`w-full mt-6`).
- **Inline Citations Block** (when `citations` present):
  - **Heading (`.section-title`)**: `"Inline Citations"` (`text-lg font-semibold text-primary mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="ordered-list">` (`list-decimal mb-3`) with numbered list items (`<li class="ml-4 list-item">`).
  - **Link Anchor (`.link-anchor`)**: `<a class="link-anchor" target="_blank" rel="noopener noreferrer">{{ citation.title }}</a>` (`text-primary-accent hover:text-primary underline`).
- **Search Queries Block** (when `searchQueries` present):
  - **Heading (`.section-title`)**: `"Search Queries"` (`text-lg font-semibold text-primary mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="ordered-list">` with `<li class="ml-4 text-secondary"><span class="italic">{{ query }}</span></li>`.
- **Google Search Suggestions Block** (when `safeRenderedContent` present):
  - **Heading (`.section-title`)**: `"Google Search Suggestions"` (`text-lg font-semibold text-primary mb-3`).
  - Rendered search suggestion HTML container (`.grounding-suggestions`).
- **STRICT Constraint**: Zero artificial dashboard metric badges (e.g. NO "3 verified links", NO "0.94 score", NO chip grids). Structured as clean ordered lists with title-case headings.

### 11. Usage & Image Optimization Metrics (`AppUsageMetricsComponent` & `ThoughtSummaryComponent`)

- **Telemetry Container (`.metrics-container gap-4 mt-6`)**:
  - Full-width wrapper with responsive layout (`flex flex-col md:flex-row`).
- **Telemetry Card Surface (`.metrics-card bg-surface-card border-surface-hover`)**:
  - Surface card (`p-4 rounded-lg flex-1` with `bg-surface-card border-surface-hover`).
- **Text Generation Token Usage Card**:
  - **Heading (`.section-title`)**: `"Text Generation Token Usage"` (`text-lg font-semibold text-primary mb-3`).
  - **Container (`.usage-grid font-mono justify-around gap-2`)**: Responsive statistics row (`flex flex-wrap`).
  - **Items**: 4 statistics formatted as `text-secondary italic text-sm`:
    - `Input: 412`
    - `Output: 168`
    - `Thought: 84`
    - `Total: 664`
- **Image Optimization Efficiency Card** (when `optimizationMetrics` present):
  - **Heading (`.section-title`)**: `"Image Optimization Efficiency"` (`text-lg font-semibold text-primary mb-3`).
  - **Container (`.usage-grid font-mono justify-around gap-2`)**: Responsive statistics row (`flex flex-wrap`).
  - **Items**: Statistics formatted as `text-secondary italic text-sm`:
    - `Original Size: 4.8 MB`
    - `Optimized Size: 56 KB`
    - `Payload Saved: 98.8%`
    - `Tokens Saved: ~5,934`
- **Thought Summary (`ThoughtSummaryComponent`)**:
  - **Heading (`.section-title`)**: `"Thought Summary"` (`text-lg font-semibold text-primary mb-3`).
  - **Content Container (`.surface-card overflow-y-auto h-64`)**: Scrollable surface card (`bg-surface-card p-4 rounded-xl border border-surface-border overflow-y-auto h-64`).
  - **Content Text**: Markdown HTML rendered in `text-secondary italic`.
- **STRICT Constraint**: Zero artificial neon badges, circular progress meters, or status chips. Clean key-value telemetry adhering strictly to the Obsidian & Indigo theme tokens.

---

### 12. Home Screen (`HomeComponent`)

- **Outer Wrapper (`section.py-8.sm:py-16`)**: Centered layout inside `<main class="flex-1 content-center">`.
- **Hero Card (`.home-card.surface-card.text-center`)**:
  - **Styling**: `surface-card` combined with `.home-card` (`max-w-2xl mx-auto sm:p-10 flex flex-col items-center gap-6`) and `text-center`.
- **Category Pill (`.home-badge border-2 font-bold`)**: `"FIREBASE AI LOGIC & AGENT PLATFORM"` (`text-xs text-primary-accent px-3 py-1 rounded-full bg-app-bg border-primary-indigo` with `border-2 font-bold` in HTML).
- **Headline (`h2`)**: `"Multimodal Vision & Real-Time Speech Studio"` (`text-2xl sm:text-3xl lg:text-4xl font-bold`).
- **Description (`p`)**: `"Analyze images with Gemini multimodal intelligence, discover grounded obscure facts, and generate real-time streaming audio with customizable voice personas."` (`text-muted max-w-lg`).
- **Primary Dynamic Hero CTA Button (`.btn-primary px-8`)**:
  - **Authenticated State**:
    - Semantic link to Studio dashboard (`[routerLink]="dashboard"`).
    - Content: `"Launch Studio"` label accompanied by standalone `<app-arrow-right-icon class="transition-transform group-hover:translate-x-1" />`.
    - Styling: `class="btn-primary px-8 group"`.
  - **Unauthenticated State**:
    - Primary action button triggering the Sign-In Modal dialog.
    - Content: `"Sign In"` label with interactive hover and focus states (strictly NO right arrow icon).
    - Styling: `class="btn-primary px-8"`.
- **Architecture & Capabilities Metadata Grid (`.home-features-grid border-t border-surface-border`)**:
  - Container: `w-full grid sm:grid-cols-3 gap-4 pt-6 mt-2` (with `border-t border-surface-border` in HTML).
  - Feature Cards (`surface-card bg-app-bg p-3`): Uses `surface-card` overridden with `bg-app-bg p-3`, containing `<p class="text-xs text-muted font-medium">{{ feature.label }}</p>` and `<p class="text-sm font-semibold text-secondary">{{ feature.value }}</p>`.
  - Clean key-value list with **zero status pills or badge chips**:
    - **MODEL PIPELINE**: `Gemini 3.8 Flash`
    - **AUDIO SYNTHESIS**: `Gemini-TTS Streaming`
    - **GROUNDING**: `Google Search Tool`
- **Strict Constraints**:
  - Strictly NO right arrow icon or secondary icons on the unauthenticated `"Sign In"` CTA button (the arrow icon is strictly reserved for the authenticated `"Launch Studio"` button).
  - Strictly NO status pills, badges, or chip tags on list items (`Multimodal`, `Real-Time`, `Verified` tags are forbidden).
  - Strictly NO obsolete model names (must use modern `Gemini 3.8 Flash`).
  - Strictly NO isolated `min-h-screen` or independent background overrides; must seamlessly inherit `.app-shell` and `.app-container`.
  - Strictly NO marketing carousels, unstyled external links, or secondary sidebar menus.

---

### 13. Sign-In Modal Dialog (`SignInModalComponent`)

- **Overlay & Backdrop**:
  - Centered modal container over a semi-transparent surface backdrop (`backdropClass: ['bg-surface-card']`).
- **Modal Card Surface (`surface-card w-md max-w-full`)**:
  - Geometry: Uses global `surface-card` (`bg-surface-card p-4 rounded-xl border border-surface-border`) with `w-md max-w-full`.
- **Header (`.modal-header border-b-2 border-surface-border`)**:
  - Layout: `flex items-center justify-between pb-3 mb-4` (with `border-b-2 border-surface-border` in HTML).
  - Title (`#sign-in-dialog-title`): `"Sign In"` (`text-xl font-bold text-primary`).
  - Close Button (`.modal-close-btn focus-visible:outline-2 focus-visible:outline-primary-hover`): Top-right button (`text-muted hover:text-primary hover:bg-surface-hover p-1.5 rounded-lg transition-all flex items-center justify-center`) housing `<app-close-icon />` with `aria-label="Close dialog"`.
- **Form Fields & Validation**:
  - **Email Field**:
    - Label (`.form-field-label`): `"EMAIL ADDRESS"` (`text-xs font-bold text-muted ml-1`).
    - Input (`form-input mt-1.5`): `<input type="email" autocomplete="username">`.
    - Validation Hint: Rendered below touched invalid field in `text-error-text mt-1 block`.
  - **Password Field**:
    - Label (`.form-field-label`): `"PASSWORD"` (`text-xs font-bold text-muted ml-1`).
    - Input (`form-input mt-1.5`): `<input type="password" autocomplete="current-password">`.
    - Validation Hint: Rendered below touched invalid field in `text-error-text mt-1 block`.
  - **Error Alert Banner (`error-block my-2 text-sm`)**:
    - Rendered conditionally on failed sign-in attempts inheriting global `.error-block` (`bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg relative`).
- **Submit Action (`mt-2 btn-primary w-full`)**:
  - Submit Button: Primary button **"Sign In"** (or **"Signing in..."**).
  - Loading State: Animated SVG spinner (`<app-spinner-icon class="w-5 h-5" />`) rendered when `signInForm().submitting()` is `true`, disabling further submissions.
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
