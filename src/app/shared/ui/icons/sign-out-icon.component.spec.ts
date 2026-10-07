import { SignOutIconComponent } from '@/shared/ui/icons/sign-out-icon.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

describe('SignOutIconComponent', () => {
  let fixture: ComponentFixture<SignOutIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignOutIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignOutIconComponent);
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

  it('should render path elements for sign-out glyph with matching path geometry', () => {
    const pathEl = fixture.debugElement.query(By.css('path'));
    expect(pathEl).toBeTruthy();
    expect(pathEl.attributes['d']).toBe(
      'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
    );
  });
});
