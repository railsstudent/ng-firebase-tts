import { MicIconComponent } from '@/shared/ui/icons/mic-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('MicIconComponent', () => {
  let fixture: ComponentFixture<MicIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MicIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MicIconComponent);
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
