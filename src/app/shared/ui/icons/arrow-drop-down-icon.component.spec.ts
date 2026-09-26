import { ArrowDropDownIconComponent } from '@/shared/ui/icons/arrow-drop-down-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('ArrowDropDownIconComponent', () => {
  let fixture: ComponentFixture<ArrowDropDownIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrowDropDownIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrowDropDownIconComponent);
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
