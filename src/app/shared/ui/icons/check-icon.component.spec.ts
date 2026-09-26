import { CheckIconComponent } from '@/shared/ui/icons/check-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('CheckIconComponent', () => {
  let fixture: ComponentFixture<CheckIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckIconComponent);
    fixture.detectChanges();
  });

  it('should create the icon component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render an SVG with aria-hidden="true"', () => {
    const svgEl = fixture.debugElement.query(By.css('svg'));
    expect(svgEl).toBeTruthy();
    expect(svgEl.attributes['aria-hidden']).toBe('true');
  });
});
