import { AuthService } from '@/core/services/auth.service';
import { HomeComponent } from '@/features/home/home.component';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    isAuthenticatedSignal = signal<boolean>(false);
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('should create the home component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the category badge, title, and description', () => {
    const badgeEl = fixture.debugElement.query(By.css('.home-badge'));
    const titleEl = fixture.debugElement.query(By.css('.home-title'));
    const descEl = fixture.debugElement.query(By.css('.home-description'));

    expect(badgeEl).toBeTruthy();
    expect(badgeEl.nativeElement.textContent.trim()).toContain('Firebase AI Logic');
    expect(titleEl).toBeTruthy();
    expect(titleEl.nativeElement.textContent.trim()).toBe('Multimodal Vision & Real-Time Speech Studio');
    expect(descEl).toBeTruthy();
    expect(descEl.nativeElement.textContent.trim()).toContain('Analyze images with Gemini multimodal intelligence');
  });

  it('should render the primary CTA sign-in button without arrow icon when unauthenticated', () => {
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    const signInBtn = fixture.debugElement.query(By.css('button.btn-sign-in'));
    const launchBtn = fixture.debugElement.query(By.css('a.btn-launch'));

    expect(signInBtn).toBeTruthy();
    expect(signInBtn.nativeElement.textContent.trim()).toBe('Sign In');
    expect(signInBtn.query(By.css('app-arrow-right-icon'))).toBeNull();
    expect(launchBtn).toBeNull();
  });

  it('should render the primary CTA launch button linking to dashboard with right arrow icon when authenticated', () => {
    isAuthenticatedSignal.set(true);
    fixture.detectChanges();

    const launchBtn = fixture.debugElement.query(By.css('a.btn-launch'));
    const signInBtn = fixture.debugElement.query(By.css('button.btn-sign-in'));

    expect(launchBtn).toBeTruthy();
    expect(launchBtn.attributes['href']).toBe('/dashboard');
    expect(launchBtn.nativeElement.textContent).toContain('Launch Studio');
    expect(launchBtn.query(By.css('app-arrow-right-icon'))).toBeTruthy();
    expect(signInBtn).toBeNull();
  });

  it('should render the 3 capabilities metadata items without status badge pills', () => {
    const featureItems = fixture.debugElement.queryAll(By.css('.feature-item'));
    expect(featureItems.length).toBe(3);

    const labels = featureItems.map((item) => item.query(By.css('.feature-label')).nativeElement.textContent.trim());
    const values = featureItems.map((item) => item.query(By.css('.feature-value')).nativeElement.textContent.trim());

    expect(labels).toEqual(['Model Pipeline', 'Audio Synthesis', 'Grounding']);
    expect(values).toEqual(['Gemini 3.8 Flash', 'Gemini-TTS Streaming', 'Google Search Tool']);

    // Assert strictly no badge pills or chips in feature items
    const badgePills = fixture.debugElement.queryAll(By.css('.feature-item .badge, .feature-item .chip'));
    expect(badgePills.length).toBe(0);
  });
});
