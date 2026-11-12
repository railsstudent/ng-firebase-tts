# 07: Render Google Maps Sources and Attribution in `GroundingComponent` Following `DESIGN.md`

**What to build:**
Update `GroundingComponent` (`grounding.component.html` and `grounding.component.css`) following the specification in `DESIGN.md` **Section 10 (`Search & Place Grounding / Citations`)** to consume `VisionGroundingMetadata.mapsCitations` (`GoogleMapsGroundingChunk[]` added in Ticket `02`) and render a **Google Maps Sources** section when `mapsCitations` is non-empty, linking each place's `title` to its `uri` accompanied by a compliant `<span translate="no" class="gmp-attribution">Google Maps</span>` attribution.

**Blocked by:** 02: Extend Vision Preprocessing with `imageBytes` and Update Vision Domain Interfaces

**Status:** done

## Target Files

- `src/app/core/vision/image-analysis.interface.ts` _(consumes `VisionGroundingMetadata.mapsCitations?: GoogleMapsGroundingChunk[]` from Ticket `02`)_
- `src/app/features/dashboard/components/grounding/grounding.component.html`
- `src/app/features/dashboard/components/grounding/grounding.component.css`
- `src/app/features/dashboard/components/grounding/grounding.component.spec.ts`

## Acceptance Criteria & Implementation Checklist

### 1. Render Google Maps Sources Block (`grounding.component.html`)

- [x] Follow `DESIGN.md` **Section 10 (`GroundingComponent`)** in `src/app/features/dashboard/components/grounding/grounding.component.html` to render the **Google Maps Sources** block when `metadata()?.mapsCitations` has items:

  ```html
  @let mapsCitations = metadata()?.mapsCitations; @let numMapsCitations = mapsCitations?.length || 0; @if
  (numMapsCitations > 0) {
  <h3 class="section-title">
    Google Maps Sources
    <span translate="no" class="gmp-attribution">Google Maps</span>
  </h3>
  <ol class="ordered-list">
    @for (place of mapsCitations; track place.placeId || place.uri || place.title) {
    <li class="ml-4 list-item">
      <a class="link-anchor" [href]="place.uri" target="_blank" rel="noopener noreferrer"> {{ place.title }} </a>
    </li>
    }
  </ol>
  }
  ```

### 2. Style `.gmp-attribution` in `grounding.component.css`

- [x] Add `.gmp-attribution` in `src/app/features/dashboard/components/grounding/grounding.component.css` adhering to `DESIGN.md` Section 10 and the Google Maps text attribution guidelines (weight 400 (`font-normal`), `12sp–16sp` (`text-sm`), `whitespace-nowrap`, accessible contrast):

  ```css
  .gmp-attribution {
    @apply font-normal text-sm whitespace-nowrap text-muted ml-2;
  }
  ```

### 3. Add Unit Tests (`grounding.component.spec.ts`)

- [x] Update `src/app/features/dashboard/components/grounding/grounding.component.spec.ts` with Red -> Green test cases verifying `mapsCitations` and `.gmp-attribution`:

  ```ts
  // TEST CASE 6: Render Google Maps Sources & Attribution
  it('should render Google Maps Sources list and compliant Google Maps attribution when mapsCitations are present', () => {
    fixture.componentRef.setInput('metadata', {
      citations: [],
      mapsCitations: [
        {
          title: 'Eiffel Tower',
          uri: 'https://maps.google.com/?cid=123',
          placeId: 'places/ChIJLU7jZClu5kcR4PcOOO6p3I0',
        },
      ],
      renderedContent: '',
      searchQueries: [],
    });
    fixture.detectChanges();

    const sectionHeader = fixture.debugElement.query(By.css('.section-title'));
    const attribution = fixture.debugElement.query(By.css('.gmp-attribution'));
    const placeLink = fixture.debugElement.query(By.css('.ordered-list a.link-anchor'));

    expect(sectionHeader).toBeTruthy();
    expect(sectionHeader.nativeElement.textContent).toContain('Google Maps Sources');
    expect(attribution).toBeTruthy();
    expect(attribution.nativeElement.getAttribute('translate')).toBe('no');
    expect(attribution.nativeElement.textContent.trim()).toBe('Google Maps');
    expect(placeLink).toBeTruthy();
    expect(placeLink.nativeElement.getAttribute('href')).toBe('https://maps.google.com/?cid=123');
    expect(placeLink.nativeElement.getAttribute('target')).toBe('_blank');
    expect(placeLink.nativeElement.getAttribute('rel')).toBe('noopener noreferrer');
    expect(placeLink.nativeElement.textContent.trim()).toBe('Eiffel Tower');
  });

  // TEST CASE 7: Omit Google Maps Sources When Empty or Undefined
  it('should omit Google Maps Sources heading and attribution when mapsCitations is empty or undefined', () => {
    fixture.componentRef.setInput('metadata', {
      citations: [{ title: 'Mars Surface', uri: 'https://nasa.gov/mars' }],
      mapsCitations: [],
      renderedContent: '',
      searchQueries: [],
    });
    fixture.detectChanges();

    const attribution = fixture.debugElement.query(By.css('.gmp-attribution'));
    const headers = fixture.debugElement.queryAll(By.css('.section-title'));

    expect(attribution).toBeNull();
    expect(headers.some((h) => h.nativeElement.textContent.includes('Google Maps Sources'))).toBe(false);
  });
  ```

### 4. Verification

- [x] Run targeted unit tests and full end-of-task checks:

  ```bash
  npm run test:spec src/app/features/dashboard/components/grounding/grounding.component.spec.ts
  npm run lint && npm run test:once
  ```
