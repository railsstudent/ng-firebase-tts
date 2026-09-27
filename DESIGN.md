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
- **Muted Text / Form Labels (`#94a3b8` - Slate 400)**: Secondary descriptions and uppercase tracked field labels.
- **Header Title Gradient**: Linear horizontal gradient from Indigo-400 (`#818cf8`) to Emerald-400 (`#34d399`).
- **Primary Action CTA (`#4f46e5` - Indigo 600)**: Full-width action buttons with `#6366f1` hover state and active focus ring.
- **Accent Citations (`#38bdf8` - Sky 400)**: External link indicators for grounding sources.
- **Error States (`#7f1d1d` bg, `#b91c1c` border, `#fecaca` text)**: Contextual alert boxes.

---

## Typography Architecture

1. **UI Text & Headings**: `Inter, ui-sans-serif, system-ui, sans-serif`
2. **Metadata & Token Counters**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
3. **No extra font downloads**: Preserves instant FCP, LCP, and zero CLS.

---

## Icons & Visual Assets

- **Inline SVGs only**: Zero third-party icon libraries or font packages.
- All icons (`PhotoIcon`, `MicIcon`, `CheckIcon`, `SpinnerIcon`, `ArrowDropDownIcon`, `ExternalLinkIcon`) render as standalone Angular SVG components with `fill="currentColor"` or `stroke="currentColor"`.

---

## CSS Variables / Tailwind v4 `@theme`

```css
@import 'tailwindcss';

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --color-app-bg: #0f172a;
  --color-surface-card: rgba(30, 41, 59, 0.5);
  --color-surface-border: #334155;
  --color-surface-hover: #475569;

  --color-text-primary: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;

  --color-primary-indigo: #4f46e5;
  --color-primary-hover: #6366f1;

  --color-error-bg: #7f1d1d;
  --color-error-border: #b91c1c;
  --color-error-text: #fecaca;
}

@utility section-wrapper {
  @apply w-full mt-6;
}

@utility section-title {
  @apply text-lg font-semibold text-(--color-text-primary) mb-3;
}

@utility surface-card {
  @apply bg-(--color-surface-card) p-4 rounded-lg border border-(--color-surface-border);
}

@utility empty-message {
  @apply text-center text-(--color-text-muted) italic;
}

@utility btn-primary {
  @apply gap-2 text-white font-semibold py-3 px-4 rounded-lg bg-(--color-primary-indigo) hover:bg-(--color-primary-hover) disabled:bg-slate-600 disabled:cursor-not-allowed transition-all;
}
```

---

## Layout Hierarchy & Viewports

### Desktop Viewport (1280px+)

- **Outer Shell**: `min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8`.
- **Inner Container**: Centered `max-w-6xl` (1152px) flex column.
- **Vertical Structure**:
  1. **Centered Header**: Title with Indigo-to-Emerald gradient, subtitle in Slate-400.
  2. **2-Column Analyzer Grid (`gap-8`)**:
     - **Left Column**: Photo uploader/dropzone, suggested tag pills, audio customizer form (Scene, Emotion, Pace, Voice combobox), and 3 speech playback buttons.
     - **Right Column**: Alternative text quote card, recommendations accordion list, and Google Search Grounding citations.
  3. **Bottom Telemetry & Thought**: Text Generation Token Usage bar (`.usage-grid` with `Input:`, `Output:`, `Thought:`, `Total:`) and Thought Summary box (`.thought-content` h-64 overflow-y-auto).
  4. **Centered Rounded Footer**: `bg-slate-800/50 border border-slate-700 rounded-2xl w-full text-center py-4 text-gray-400`.
  5. **Floating PWA Toast**: Fixed at `bottom-6 right-6`.

### Mobile Viewport (<768px)

- Single-column linear stack with full-width touch targets (`p-4`), vertically ordered cards, and touch-optimized controls.

---

## Strict Component Specifications (Code Contract)

### 1. App Header (`HeaderComponent`)

- **Container**: Centered text block (`text-center mb-6 sm:mb-8`).
- **Title (`h1`)**: `"Firebase AI Logic Obscure Fact Speech Generator"` (`text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent`).
- **Subtitle (`p`)**: `"Upload an image to generate alt text and tags with Gemini"` (`text-sm sm:text-base md:text-lg text-slate-400 mt-2`).
- **Constraints**: No navigation bars, tabs, breadcrumbs, or icons.

### 2. App Footer (`FooterComponent`)

- **Container**: Rounded floating card (`bg-slate-800/50 border border-slate-700 rounded-2xl w-full mt-auto`).
- **Content**: Centered text (`container mx-auto px-6 py-4 text-center text-gray-400 text-sm`):
  - `© 2026 Image Analysis and Text-to-Speech Application.`
  - `Built with Angular, Firebase AI Logic, and TailwindCSS 4.`

### 3. PWA Update Notification Banner (`PwaUpdateBanner`)

- **Positioning**: Fixed overlay at `fixed bottom-6 right-6 z-50`.
- **Card**: `bg-slate-800 text-white p-4 rounded-lg shadow-2xl flex items-center gap-4 border border-slate-700`.
- **Message**: `"A new version is available!"` (`text-sm font-medium`).
- **Action Button**: `"Reload"` (`bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-all`).

### 4. Photo Picker & Dropzone (`PhotoPickerComponent`)

- **Dropzone Area**: `border-2 border-dashed border-slate-600 rounded-xl h-48 sm:h-64 md:h-80 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-700/50 hover:border-slate-500 transition-colors`.
- **Drag-Active State**: `bg-slate-700/80 border-indigo-500 text-indigo-200 scale-102 shadow-indigo-500/20 shadow-md`.
- **Icons & Text**: Centered camera/photo SVG icon (`text-slate-500`), `"Drag and drop your image here, or browse"`, `"Supports PNG, JPG, WEBP"`.
- **Preview State**: Rounded image thumbnail (`max-h-96 rounded-xl shadow-lg`) with floating `"Change Image"` action overlay.
- **Action CTA**: Full-width primary button **"Analyze Image"** with animated SVG loading spinner.

### 5. Suggested Tags Display (`TagsDisplayComponent`)

- **Container**: Horizontal scrollable/wrapping tag row.
- **Pill Badges**: `rounded-full` pill badges with 1px border (`#334155`), active highlight state on click.

### 6. Audio Customizer Form (`AudioTagsComponent` & `VoiceSelectorComponent`)

- **Scene Field**: Multi-line textarea for scene description (`bg-slate-900 border-slate-700 text-slate-100 rounded-lg p-2.5 focus:ring-indigo-500`).
- **Emotion Field**: Text input (`bg-slate-900 border-slate-700 rounded-lg p-2.5`).
- **Pace Field**: Text input (`bg-slate-900 border-slate-700 rounded-lg p-2.5`).
- **Field Labels**: `text-xs uppercase font-semibold tracking-wider text-slate-400`.
- **Voice Selector**: Accessible combobox with dropdown list, microphone icon, voice options (`Puck`, `Charon`, `Kore`, `Fenrir`, `Aoede`), and checkmark icon on selected item.

### 7. Speech Generation Controls (`TextToSpeechComponent`)

- **Trigger Buttons Container (`.btn-container`)**: `flex justify-evenly gap-4` (flex-wrap on mobile).
- **Audio Buttons (`.btn-audio`)**: `mt-6 flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-md gap-2 transition-all`.
- **Button Labels & Icons (Strict Code Contract)**:
  - 1. `"Play Speech (Sync)"`
  - 1. `"Play Speech (Stream)"`
  - 1. `"Web Audio API"`
  - **STRICT**: Buttons contain ONLY button text and an animated SVG loading spinner (`.spinner-icon animate-spin h-5 w-5`) when `isLoading` is true. Strictly NO play icons (▶), NO speaker icons (🔊), NO waveform icons.
- **Audio Output Figure (`.playback-figure`)**:
  - Rendered conditionally when `audioUrl` is present:
  - Container: `mt-6 p-4 bg-slate-900/40 border border-slate-700/50 rounded-xl flex flex-col gap-2`.
  - Caption (`.playback-caption`): `"Listen to the Gemini-TTS:"` (`text-sm font-medium text-slate-400`).
  - Audio Element (`.playback-audio`): Standard native `<audio controls>` player (`w-full outline-none`).

### 8. Alternative Text Card (`AltTextPanelComponent`)

- **Heading (`.display-title`)**: `"Generated Alternative Text"` (`text-lg font-semibold text-slate-300 mb-3`).
- **Card (`.display-card`)**: Rounded container (`bg-slate-800/50 border border-slate-700 rounded-xl p-6`).
- **Content (`.display-text`)**: Quoted generated alt-text string in `text-slate-200 italic` (`"..."`).
- **STRICT Constraint**: Strictly NO model badges (e.g. "Gemini 1.5 Pro"), NO label badges, and NO pill indicators.

### 9. Recommendations Accordion (`RecommendationsComponent`)

- **Heading (`.recommendations-title`)**: Strictly `"Recommendations"` (`text-lg font-semibold text-slate-300 mb-3`).
- **Accordion List (`.recommendations-list`)**: Multi-expandable group (`[multiExpandable]="true"`).
- **Item Trigger (`.recommendation-trigger`)**:
  - Contains ID and title: `<span class="recommendation-id">{{ item.id }}: </span> <span class="recommendation-text">{{ item.text }}</span>`
  - Right-aligned rotating SVG chevron icon (`.expand-icon`).
  - **STRICT**: Strictly NO status badges, NO confidence pills (e.g. "HIGH CONFIDENCE", "SYNTH READY", "Optimal").
- **Expanded Panel**:
  - Detailed explanation formatted as `<span class="recommendation-reason-label">Reason:</span> <span class="recommendation-reason-text">{{ item.reason }}</span>`.

### 10. Web Grounding & Citations (`GroundingComponent`)

- **Container (`.grounding-wrapper`)**: Full-width section (`w-full mt-6`).
- **Inline Citations Block** (when `citations` present):
  - **Heading (`.section-title`)**: `"Inline Citations"` (`text-lg font-semibold text-slate-300 mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="list-decimal mb-3">` with numbered list items (`.list-item ml-4 text-slate-200`).
  - **Link Anchor (`.link-anchor`)**: `<a class="text-indigo-400 hover:text-indigo-300 underline" target="_blank" rel="noopener noreferrer">{{ citation.title }}</a>`.
- **Search Queries Block** (when `searchQueries` present):
  - **Heading (`.section-title`)**: `"Search Queries"` (`text-lg font-semibold text-slate-300 mb-3`).
  - **Numbered List (`.ordered-list`)**: `<ol class="list-decimal mb-3">` with `<li class="query-text ml-4 text-slate-200"><span class="query-italic italic">{{ query }}</span></li>`.
- **Google Search Suggestions Block** (when `safeRenderedContent` present):
  - **Heading (`.section-title`)**: `"Google Search Suggestions"` (`text-lg font-semibold text-slate-300 mb-3`).
  - Rendered search suggestion HTML container.
- **STRICT Constraint**: Zero artificial dashboard metric badges (e.g. NO "3 verified links", NO "0.94 score", NO chip grids). Structured as clean ordered lists with title-case headings.

### 11. Text Generation Token Usage & Thought Summary (`DashboardComponent` & `ThoughtSummaryComponent`)

- **Text Generation Token Usage (`.usage-section`)**:
  - **Heading (`.section-title`)**: `"Text Generation Token Usage"` (`text-lg font-semibold text-slate-300 mb-3`).
  - **Container (`.usage-grid`)**: Single rounded bar (`bg-slate-700/50 p-4 rounded-lg border border-slate-600 flex flex-wrap justify-around`).
  - **Items (`.usage-item`)**: 4 inline statistics formatted as `text-slate-200 italic`:
    - `Input: 412`
    - `Output: 168`
    - `Thought: 84`
    - `Total: 664`
- **Thought Summary (`ThoughtSummaryComponent`)**:
  - **Heading (`.section-title`)**: `"Thought Summary"` (`text-lg font-semibold text-slate-300 mb-3`).
  - **Content Container (`.thought-content`)**: Scrollable box (`bg-slate-700/50 p-4 rounded-lg border border-slate-600 overflow-y-auto h-64`).
  - **Content Text (`.thought-text`)**: Markdown HTML rendered in `text-slate-200 italic`.
