import { CloseIconComponent } from '@/shared/ui/icons/close-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('CloseIconComponent', () => {
  let fixture: ComponentFixture<CloseIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloseIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CloseIconComponent);
    fixture.detectChanges();
  });

  it('should create the icon component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render an SVG with viewBox="0 0 24 24" and aria-hidden="true"', () => {
    const svgEl = fixture.debugElement.query(By.css('svg'));
    expect(svgEl).toBeTruthy();
    expect(svgEl.attributes['aria-hidden']).toBe('true');
    expect(svgEl.attributes['viewBox']).toBe('0 0 24 24');
  });

  it('should render line elements for close glyph', () => {
    const lines = fixture.debugElement.queryAll(By.css('line'));
    expect(lines.length).toBe(2);
    expect(lines[0]?.attributes['x1']).toBe('18');
    expect(lines[0]?.attributes['y1']).toBe('6');
    expect(lines[0]?.attributes['x2']).toBe('6');
    expect(lines[0]?.attributes['y2']).toBe('18');
    expect(lines[1]?.attributes['x1']).toBe('6');
    expect(lines[1]?.attributes['y1']).toBe('6');
    expect(lines[1]?.attributes['x2']).toBe('18');
    expect(lines[1]?.attributes['y2']).toBe('18');
  });
});
