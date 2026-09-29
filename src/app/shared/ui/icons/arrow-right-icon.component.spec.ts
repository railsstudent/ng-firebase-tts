import { ArrowRightIconComponent } from '@/shared/ui/icons/arrow-right-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('ArrowRightIconComponent', () => {
  let fixture: ComponentFixture<ArrowRightIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrowRightIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrowRightIconComponent);
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

  it('should render the arrow path element', () => {
    const pathEl = fixture.debugElement.query(By.css('path'));
    expect(pathEl).toBeTruthy();
  });
});
