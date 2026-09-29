import { HeaderComponent } from '@/shared/ui/layout/header/header.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
  });

  it('should create the header component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the centered gradient h1 title', () => {
    const titleEl = fixture.debugElement.query(By.css('h1'));
    expect(titleEl).toBeTruthy();
    expect(titleEl.nativeElement.textContent.trim()).toBe('Firebase AI Logic Obscure Fact Speech Generator');
  });

  it('should render the left-anchored home button with accessible label and router link', () => {
    const homeBtn = fixture.debugElement.query(By.css('a.header-home-btn'));
    expect(homeBtn).toBeTruthy();
    expect(homeBtn.attributes['aria-label']).toBe('Go to Home Screen');
    expect(homeBtn.attributes['href']).toBe('/home');
    expect(homeBtn.query(By.css('app-home-icon'))).toBeTruthy();
  });

  it('should not render any subtitle paragraph', () => {
    const subtitleEl = fixture.debugElement.query(By.css('.header-subtitle'));
    const pEl = fixture.debugElement.query(By.css('p'));
    expect(subtitleEl).toBeNull();
    expect(pEl).toBeNull();
  });
});
