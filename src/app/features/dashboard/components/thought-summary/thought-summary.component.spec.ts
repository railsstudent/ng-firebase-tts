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
    const thoughtSection = fixture.debugElement.query(By.css('.thought-section'));
    const thoughtText = fixture.debugElement.query(By.css('.thought-text'));

    expect(wrapper).toBeTruthy();
    expect(thoughtSection).toBeTruthy();
    expect(thoughtText.nativeElement.innerHTML).toContain('Thinking about Mars surface chemistry...');
  });
});
