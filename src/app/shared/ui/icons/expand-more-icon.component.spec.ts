import { ExpandMoreIconComponent } from '@/shared/ui/icons/expand-more-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('ExpandMoreIconComponent', () => {
  let fixture: ComponentFixture<ExpandMoreIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpandMoreIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpandMoreIconComponent);
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
