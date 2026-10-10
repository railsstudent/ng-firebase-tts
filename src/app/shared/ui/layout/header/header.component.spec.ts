import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthService } from '@/core/auth';
import { HeaderComponent } from './header.component';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    isAuthenticatedSignal = signal<boolean>(false);
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
      signOut: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

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

  it('should NOT render sign-out button when unauthenticated', () => {
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    const signOutBtn = fixture.debugElement.query(By.css('button[aria-label="Sign out"]'));
    expect(signOutBtn).toBeNull();
  });

  it('should render sign-out button with icon when authenticated', () => {
    isAuthenticatedSignal.set(true);
    fixture.detectChanges();

    const signOutBtn = fixture.debugElement.query(By.css('button[aria-label="Sign out"]'));
    expect(signOutBtn).toBeTruthy();
    expect(signOutBtn.query(By.css('app-sign-out-icon'))).toBeTruthy();
  });

  it('should call AuthService.signOut and Router.navigate when sign-out is clicked', async () => {
    isAuthenticatedSignal.set(true);
    fixture.detectChanges();

    const signOutBtn = fixture.debugElement.query(By.css('button[aria-label="Sign out"]'));
    expect(signOutBtn).toBeTruthy();

    signOutBtn.nativeElement.click();
    await fixture.whenStable();

    expect(mockAuthService.signOut).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([APP_LINKS.HOME]);
  });
});
