import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroundingComponent } from './grounding.component';
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
});
