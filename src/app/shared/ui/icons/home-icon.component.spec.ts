import { HomeIconComponent } from '@/shared/ui/icons/home-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('HomeIconComponent', () => {
  let fixture: ComponentFixture<HomeIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeIconComponent);
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

  it('should render the home path elements', () => {
    const pathEl = fixture.debugElement.query(By.css('path'));
    const polylineEl = fixture.debugElement.query(By.css('polyline'));
    expect(pathEl).toBeTruthy();
    expect(polylineEl).toBeTruthy();
  });
});
