import { GroundingComponent } from '@/features/dashboard/components/grounding/grounding.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By, SafeHtml } from '@angular/platform-browser';

describe('GroundingComponent', () => {
  let component: GroundingComponent;
  let fixture: ComponentFixture<GroundingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroundingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GroundingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Render Citations List
  it('should render citations list with links', () => {
    fixture.componentRef.setInput('metadata', {
      citations: [{ title: 'Mars Surface', uri: 'https://nasa.gov/mars' }],
    });
    fixture.detectChanges();

    const citationHeader = fixture.debugElement.query(By.css('.section-title'));
    const link = fixture.debugElement.query(By.css('.link-anchor'));

    expect(citationHeader).toBeTruthy();
    expect(citationHeader.nativeElement.textContent).toContain('Inline Citations');
    expect(link).toBeTruthy();
    expect(link.nativeElement.getAttribute('href')).toBe('https://nasa.gov/mars');
    expect(link.nativeElement.textContent.trim()).toBe('Mars Surface');
  });

  // TEST CASE 2: Render Search Queries
  it('should render google search queries', () => {
    fixture.componentRef.setInput('metadata', {
      searchQueries: ['Mars soil chemistry', 'Gemini AI search'],
    });
    fixture.detectChanges();

    const queryItems = fixture.debugElement.queryAll(By.css('.query-text'));
    expect(queryItems.length).toBe(2);
    expect(queryItems[0].nativeElement.textContent).toContain('Mars soil chemistry');
    expect(queryItems[1].nativeElement.textContent).toContain('Gemini AI search');
  });

  // TEST CASE 3: Rendered Content sanitizer
  it('should securely bypass and bind safe HTML suggestions', () => {
    fixture.componentRef.setInput('metadata', {
      renderedContent: '<div class="carousel"><a>Nasa Mars</a></div>',
    });
    fixture.detectChanges();

    const safeContent: SafeHtml = component.safeRenderedContent();
    expect(safeContent).toBeTruthy();
  });

  // TEST CASE 4: External Link Enhancement (TDD Seam)
  it('should enhance rendered search suggestion links and apply whitespace-normal exclusively to the first carousel', () => {
    fixture.componentRef.setInput('metadata', {
      renderedContent:
        '<div class="carousel"><a href="https://example.com/1">First Carousel Link</a></div><div class="carousel"><a href="https://example.com/2">Second Carousel Link</a></div>',
    });
    fixture.detectChanges();

    const carousels = fixture.debugElement.queryAll(By.css('.grounding-suggestions .carousel'));
    expect(carousels.length).toBe(2);

    // Verify whitespace-normal is applied exclusively to the first carousel
    expect(carousels[0].nativeElement.classList.contains('whitespace-normal')).toBe(true);
    expect(carousels[1].nativeElement.classList.contains('whitespace-normal')).toBe(false);

    const firstSuggestionLink = carousels[0].query(By.css('a'));
    expect(firstSuggestionLink).toBeTruthy();
    expect(firstSuggestionLink.nativeElement.getAttribute('target')).toBe('_blank');
    expect(firstSuggestionLink.nativeElement.getAttribute('rel')).toBe('noopener noreferrer nofollow external');
    expect(firstSuggestionLink.nativeElement.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(firstSuggestionLink.nativeElement.getAttribute('title')).toBe('Opens in a new tab');
    expect(firstSuggestionLink.nativeElement.classList.contains('link-anchor')).toBe(true);
    expect(firstSuggestionLink.nativeElement.classList.contains('mb-2')).toBe(true);
  });

  // TEST CASE 5: Multiple Search Suggestions Rendering & Attributes
  it('should enhance all links when renderedContent contains multiple suggestions', () => {
    fixture.componentRef.setInput('metadata', {
      renderedContent:
        '<div class="carousel"><a href="https://example.com/1">First Suggestion</a><a href="https://example.com/2">Second Suggestion</a><a href="https://example.com/3">Third Suggestion</a></div>',
    });
    fixture.detectChanges();

    const carousel = fixture.debugElement.query(By.css('.grounding-suggestions .carousel'));
    const suggestionLinks = fixture.debugElement.queryAll(By.css('.grounding-suggestions a'));

    expect(carousel).toBeTruthy();
    expect(carousel.nativeElement.classList.contains('whitespace-normal')).toBe(true);
    expect(suggestionLinks.length).toBe(3);

    for (const link of suggestionLinks) {
      expect(link.nativeElement.getAttribute('target')).toBe('_blank');
      expect(link.nativeElement.getAttribute('rel')).toBe('noopener noreferrer nofollow external');
      expect(link.nativeElement.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(link.nativeElement.getAttribute('title')).toBe('Opens in a new tab');
      expect(link.nativeElement.classList.contains('link-anchor')).toBe(true);
      expect(link.nativeElement.classList.contains('mb-2')).toBe(true);
    }
  });
});
