# 06: Render Image Subject Category Badge in `AltTextPanel` Following `DESIGN.md`

**What to build:**
Update `AltTextPanel` (`alt-text-panel.component.html` and `alt-text-panel.component.css`) following the specification in `DESIGN.md` **Section 8 (`Alternative Text Card`)** to render a header row (`.alt-text-header`) directly above the `.surface-card` quote box containing the `"Generated Alternative Text"` heading and a conditional `.category-badge` pill displaying the classified **Image Subject Category** (`place`, `people`, or `general`) when `analysis()?.category` is present.

**Blocked by:** 02: Extend Vision Preprocessing with `imageBytes` and Update Vision Domain Interfaces

**Status:** done

## Target Files

- `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.html`
- `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.css`
- `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.spec.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Update Template to Render `.alt-text-header` and `.category-badge` (`alt-text-panel.component.html`)

- [x] Follow `DESIGN.md` **Section 8 (`AltTextPanelComponent`)** in `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.html`:

  ```html
  @if (!isLoading() && imageAnalysis) {
  <div class="results-wrapper">
    @let altText = imageAnalysis.parsed.alternativeText || 'Default alternative text'; @let category =
    imageAnalysis.category; @if (altText) {
    <div class="w-full mt-6">
      <div class="alt-text-header">
        <h3 class="section-title mb-0">Generated Alternative Text</h3>
        @if (category) {
        <span class="category-badge">{{ category }}</span>
        }
      </div>
      <div class="surface-card">
        <p class="text-secondary italic">"{{ altText }}"</p>
      </div>
    </div>
    }

    <app-recommendations-display [recommendations]="imageAnalysis.parsed.recommendations || []" />
  </div>
  }
  ```

### 2. Style `.alt-text-header` and `.category-badge` in `alt-text-panel.component.css`

- [x] Add `.alt-text-header` and `.category-badge` in `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.css` per `DESIGN.md` Section 8:

  ```css
  .alt-text-header {
    @apply flex items-center justify-between gap-2 mb-3;
  }

  .category-badge {
    @apply bg-app-bg text-primary-accent border border-primary-indigo text-xs font-semibold px-3 py-0.5 rounded-full;
  }
  ```

### 3. Add Unit Tests (`alt-text-panel.component.spec.ts`)

- [x] Update `src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.spec.ts` with Red -> Green test cases verifying `.category-badge` rendering:

  ```ts
  // TEST CASE 5: Image Subject Category Badge Rendering
  it('should render .category-badge inside .alt-text-header when analysis.category is provided', () => {
    fixture.componentRef.setInput('analysis', {
      parsed: {
        alternativeText: 'Eiffel Tower (48.8584° N, 2.2945° E) at dusk.',
        recommendations: [],
      },
      metadata: {
        citations: [],
        searchQueries: [],
      },
      category: 'place',
    });
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('.alt-text-header'));
    const badge = fixture.debugElement.query(By.css('.category-badge'));

    expect(header).toBeTruthy();
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('place');
  });

  // TEST CASE 6: Omit Category Badge When Undefined
  it('should not render .category-badge when analysis.category is undefined', () => {
    fixture.componentRef.setInput('analysis', {
      parsed: {
        alternativeText: 'A high contrast graphic of Mars.',
        recommendations: [],
      },
      metadata: {
        citations: [],
        searchQueries: [],
      },
    });
    fixture.componentRef.setInput('error', undefined);
    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('.category-badge'));
    expect(badge).toBeNull();
  });
  ```

### 4. Verification

- [x] Run targeted unit tests:

  ```bash
  npm run test:spec src/app/features/dashboard/components/alt-text-panel/alt-text-panel.component.spec.ts
  ```
