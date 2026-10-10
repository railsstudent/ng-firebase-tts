import { ThoughtSummaryComponent } from './thought-summary.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('ThoughtSummaryComponent', () => {
  let component: ThoughtSummaryComponent;
  let fixture: ComponentFixture<ThoughtSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThoughtSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ThoughtSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Empty State
  it('should not render anything when thought is empty', () => {
    fixture.componentRef.setInput('thought', '');
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    expect(wrapper).toBeNull();
  });

  // TEST CASE 2: Thought Summary Rendered
  it('should render thought summary card with parsed markdown when thought is provided', () => {
    fixture.componentRef.setInput('thought', 'Thinking about Mars surface chemistry...');
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    const thoughtContent = fixture.debugElement.query(By.css('.thought-content'));
    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));

    expect(wrapper).toBeTruthy();
    expect(thoughtContent).toBeTruthy();
    expect(thoughtText.nativeElement.innerHTML).toContain('Thinking about Mars surface chemistry...');
  });

  // TEST CASE 3: Markdown Syntax Rendering (Seam 1)
  it('should parse markdown bold and italic formatting into HTML tags', () => {
    fixture.componentRef.setInput('thought', '**Reasoning:** Identifying *high confidence* features.');
    fixture.detectChanges();

    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));
    expect(thoughtText.nativeElement.innerHTML).toContain('<strong>Reasoning:</strong>');
    expect(thoughtText.nativeElement.innerHTML).toContain('<em>high confidence</em>');
  });

  // TEST CASE 4: Newline / Paragraph Separation (Seam 2)
  it('should convert all double newlines into break tags across multiple paragraphs', () => {
    fixture.componentRef.setInput(
      'thought',
      'Step 1: Inspect composition.\n\nStep 2: Generate tags.\n\nStep 3: Synthesize speech.',
    );
    fixture.detectChanges();

    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));
    const breaks = thoughtText.nativeElement.querySelectorAll('br');
    expect(breaks.length).toBe(2);
    expect(thoughtText.nativeElement.textContent).toContain('Step 1: Inspect composition.');
    expect(thoughtText.nativeElement.textContent).toContain('Step 2: Generate tags.');
    expect(thoughtText.nativeElement.textContent).toContain('Step 3: Synthesize speech.');
  });

  // TEST CASE 5: XSS Sanitization via DOMPurify (Seam 3)
  it('should sanitize XSS vectors and strip dangerous scripts and event handlers', () => {
    fixture.componentRef.setInput(
      'thought',
      'Safe thought <script>alert("xss")</script><img src="x" onerror="alert(1)">',
    );
    fixture.detectChanges();

    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));
    const innerHtml = thoughtText.nativeElement.innerHTML;
    expect(innerHtml).not.toContain('<script>');
    expect(innerHtml).not.toContain('onerror');
    expect(innerHtml).toContain('Safe thought');
  });

  // TEST CASE 6: Inline Code Preservation (Seam 4)
  it('should preserve inline code blocks in reasoning output', () => {
    fixture.componentRef.setInput('thought', 'Extracted `mars_rover_panorama` tag.');
    fixture.detectChanges();

    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));
    expect(thoughtText.nativeElement.innerHTML).toContain('<code>mars_rover_panorama</code>');
  });
});
