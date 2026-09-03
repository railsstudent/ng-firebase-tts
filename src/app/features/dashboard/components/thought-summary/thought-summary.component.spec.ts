import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThoughtSummaryComponent } from './thought-summary.component';
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
  it('should not render anything when thought and tokenUsage are empty', () => {
    fixture.componentRef.setInput('thought', '');
    fixture.componentRef.setInput('tokenUsage', undefined);
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    expect(wrapper).toBeNull();
  });

  // TEST CASE 2: Token Usage Only
  it('should render token usage card and hide thought box when only tokenUsage is provided', () => {
    fixture.componentRef.setInput('thought', '');
    fixture.componentRef.setInput('tokenUsage', { input: 10, output: 20, thought: 5, total: 35 });
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    const usageSection = fixture.debugElement.query(By.css('.usage-section'));
    const thoughtSection = fixture.debugElement.query(By.css('.thought-section'));

    expect(wrapper).toBeTruthy();
    expect(usageSection).toBeTruthy();
    expect(thoughtSection).toBeNull();
    expect(usageSection.nativeElement.textContent).toContain('Input: 10');
    expect(usageSection.nativeElement.textContent).toContain('Total: 35');
  });

  // TEST CASE 3: Thought Summary Only
  it('should render thought summary card and hide token usage when only thought is provided', () => {
    fixture.componentRef.setInput('thought', 'Thinking about Mars surface chemistry...');
    fixture.componentRef.setInput('tokenUsage', undefined);
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    const usageSection = fixture.debugElement.query(By.css('.usage-section'));
    const thoughtSection = fixture.debugElement.query(By.css('.thought-section'));

    expect(wrapper).toBeTruthy();
    expect(usageSection).toBeNull();
    expect(thoughtSection).toBeTruthy();
    expect(thoughtSection.nativeElement.textContent).toContain('Thinking about Mars surface chemistry...');
  });

  // TEST CASE 4: Both Provided
  it('should render both cards when both inputs are provided', () => {
    fixture.componentRef.setInput('thought', 'Analyzing pixels...');
    fixture.componentRef.setInput('tokenUsage', { input: 1, output: 2, thought: 3, total: 6 });
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.summary-container'));
    const usageSection = fixture.debugElement.query(By.css('.usage-section'));
    const thoughtSection = fixture.debugElement.query(By.css('.thought-section'));

    expect(wrapper).toBeTruthy();
    expect(usageSection).toBeTruthy();
    expect(thoughtSection).toBeTruthy();
  });
});
