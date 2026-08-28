import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AltTextDisplayComponent } from './alt-text-display.component';
import { By } from '@angular/platform-browser';

describe('AltTextDisplayComponent', () => {
  let component: AltTextDisplayComponent;
  let fixture: ComponentFixture<AltTextDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AltTextDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AltTextDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // TEST CASE 1: Empty Alt Text State
  it('should render nothing when altText is empty', () => {
    fixture.componentRef.setInput('altText', '');
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.display-wrapper'));
    expect(wrapper).toBeNull();
  });

  // TEST CASE 2: Provided Alt Text State
  it('should render correct alternative text when provided', () => {
    fixture.componentRef.setInput('altText', 'A red planet landscape.');
    fixture.detectChanges();

    const wrapper = fixture.debugElement.query(By.css('.display-wrapper'));
    const textEl = fixture.debugElement.query(By.css('.display-text'));

    expect(wrapper).toBeTruthy();
    expect(textEl).toBeTruthy();
    expect(textEl.nativeElement.textContent).toContain('A red planet landscape.');
  });
});
