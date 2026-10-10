import { AuthService } from '@/core/auth';
import { HomeComponent } from './home.component';
import { SignInModalComponent } from '@/shared/ui/sign-in-modal/sign-in-modal.component';
import { Dialog } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let dialogClosedSubject: Subject<unknown>;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    ensureAuth: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    dialogClosedSubject = new Subject<unknown>();
    isAuthenticatedSignal = signal<boolean>(false);
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
      ensureAuth: vi.fn().mockResolvedValue({}),
    };
    mockDialog = {
      open: vi.fn().mockReturnValue({ closed: dialogClosedSubject.asObservable() }),
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Dialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  it('should create the home component and call ensureAuth to restore session', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(mockAuthService.ensureAuth).toHaveBeenCalledTimes(1);
  });

  it('should handle errors from ensureAuth gracefully without throwing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejectionError = new Error('Auth initialization failed');
    mockAuthService.ensureAuth.mockRejectedValue(rejectionError);

    const errorFixture = TestBed.createComponent(HomeComponent);
    errorFixture.detectChanges();

    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to restore auth session:', rejectionError);
    consoleErrorSpy.mockRestore();
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

  it('should open SignInModalComponent dialog with proper backdrop configuration when Sign In button is clicked', async () => {
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    const signInBtn = fixture.debugElement.query(By.css('button.btn-sign-in'));
    expect(signInBtn).toBeTruthy();

    const openModalSpy = vi.spyOn(fixture.componentInstance, 'openSignInModal');

    signInBtn.nativeElement.click();

    expect(openModalSpy).toHaveBeenCalledTimes(1);
    await openModalSpy.mock.results[0].value;

    expect(mockDialog.open).toHaveBeenCalledWith(
      SignInModalComponent,
      expect.objectContaining({
        backdropClass: ['backdrop-blur-sm', 'bg-black/40'],
      }),
    );
  });

  it('should only open one dialog when Sign In button is clicked multiple times rapidly', async () => {
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    const signInBtn = fixture.debugElement.query(By.css('button.btn-sign-in'));
    expect(signInBtn).toBeTruthy();

    const openModalSpy = vi.spyOn(fixture.componentInstance, 'openSignInModal');

    // Simulate rapid double click
    signInBtn.nativeElement.click();
    signInBtn.nativeElement.click();

    expect(openModalSpy).toHaveBeenCalledTimes(2);
    await Promise.all(openModalSpy.mock.results.map((r) => r.value));

    expect(mockDialog.open).toHaveBeenCalledTimes(1);
  });

  it('should reset dialog reference and allow reopening when dialog is closed', async () => {
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    const signInBtn = fixture.debugElement.query(By.css('button.btn-sign-in'));
    expect(signInBtn).toBeTruthy();

    const openModalSpy = vi.spyOn(fixture.componentInstance, 'openSignInModal');

    // First click opens the dialog
    signInBtn.nativeElement.click();
    await openModalSpy.mock.results[0].value;
    expect(mockDialog.open).toHaveBeenCalledTimes(1);

    // Clicking while open does not open another dialog
    signInBtn.nativeElement.click();
    await openModalSpy.mock.results[1].value;
    expect(mockDialog.open).toHaveBeenCalledTimes(1);

    // Dialog emits closed event
    dialogClosedSubject.next(undefined);

    // Clicking again now opens a new dialog
    signInBtn.nativeElement.click();
    await openModalSpy.mock.results[2].value;
    expect(mockDialog.open).toHaveBeenCalledTimes(2);
  });
});
