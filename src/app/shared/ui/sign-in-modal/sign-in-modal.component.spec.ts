import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthService } from '@/core/services/auth.service';
import { SpinnerIconComponent } from '@/shared/ui/icons/spinner-icon.component';
import { SignInModalComponent } from '@/shared/ui/sign-in-modal/sign-in-modal.component';
import { DialogRef } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

describe('SignInModalComponent', () => {
  let fixture: ComponentFixture<SignInModalComponent>;
  let mockDialogRef: {
    close: ReturnType<typeof vi.fn>;
  };
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    signIn: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    isAuthenticatedSignal = signal<boolean>(false);
    mockDialogRef = {
      close: vi.fn(),
    };
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
      signIn: vi.fn().mockImplementation(async () => {
        isAuthenticatedSignal.set(true);
        return true;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SignInModalComponent],
      providers: [
        provideRouter([]),
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(SignInModalComponent);
    fixture.detectChanges();
  });

  describe('Accessibility & Layout Contract', () => {
    it('should create the modal component', () => {
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render dialog container with ARIA attributes and title', () => {
      const dialogEl = fixture.debugElement.query(By.css('[role="dialog"]'));
      expect(dialogEl).toBeTruthy();
      expect(dialogEl.attributes['aria-modal']).toBe('true');
      expect(dialogEl.attributes['aria-labelledby']).toBe('sign-in-dialog-title');

      const titleEl = fixture.debugElement.query(By.css('#sign-in-dialog-title'));
      expect(titleEl).toBeTruthy();
      expect(titleEl.nativeElement.textContent.trim()).toBe('Sign In');
    });

    it('should render close button with accessible aria-label', () => {
      const closeBtn = fixture.debugElement.query(By.css('button[aria-label="Close dialog"]'));
      expect(closeBtn).toBeTruthy();
    });

    it('should render email and password input fields with proper types and autocompletes', () => {
      const emailInput = fixture.debugElement.query(By.css('input[type="email"]'));
      expect(emailInput).toBeTruthy();
      expect(emailInput.attributes['autocomplete']).toBe('username');

      const passwordInput = fixture.debugElement.query(By.css('input[type="password"]'));
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.attributes['autocomplete']).toBe('current-password');
    });

    it('should render the primary Sign In submit button', () => {
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));
      expect(submitBtn).toBeTruthy();
      expect(submitBtn.nativeElement.textContent.trim()).toContain('Sign In');
    });

    it('should strictly adhere to minimal dialog constraints without secondary auth links', () => {
      const ssoButtons = fixture.debugElement.queryAll(By.css('.sso-btn, [data-provider]'));
      const forgotPasswordLink = fixture.debugElement.query(By.css('a[href*="forgot"], a[href*="reset"]'));
      const signUpLink = fixture.debugElement.query(By.css('a[href*="signup"], a[href*="register"]'));

      expect(ssoButtons.length).toBe(0);
      expect(forgotPasswordLink).toBeNull();
      expect(signUpLink).toBeNull();
    });
  });

  describe('Dialog Dismissal', () => {
    it('should call dialogRef.close when close button is clicked', () => {
      const closeBtn = fixture.debugElement.query(By.css('button[aria-label="Close dialog"]'));
      expect(closeBtn).toBeTruthy();

      closeBtn.nativeElement.click();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation & Error Handling', () => {
    it('should display error block when errorMessage is present on rejected sign-in', async () => {
      mockAuthService.signIn.mockRejectedValueOnce(new Error('Invalid credentials'));

      const emailInput = fixture.debugElement.query(By.css('input[type="email"]'));
      const passwordInput = fixture.debugElement.query(By.css('input[type="password"]'));
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));

      emailInput.nativeElement.value = 'user@example.com';
      emailInput.nativeElement.dispatchEvent(new Event('input'));
      passwordInput.nativeElement.value = 'validPassword123';
      passwordInput.nativeElement.dispatchEvent(new Event('input'));

      submitBtn.nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorBlock = fixture.debugElement.query(By.css('.error-block'));
      expect(errorBlock).toBeTruthy();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should display error block when signIn resolves but isAuthenticated remains false', async () => {
      mockAuthService.signIn.mockImplementationOnce(async () => {
        isAuthenticatedSignal.set(false);
        return false;
      });

      const emailInput = fixture.debugElement.query(By.css('input[type="email"]'));
      const passwordInput = fixture.debugElement.query(By.css('input[type="password"]'));
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));

      emailInput.nativeElement.value = 'user@example.com';
      emailInput.nativeElement.dispatchEvent(new Event('input'));
      passwordInput.nativeElement.value = 'validPassword123';
      passwordInput.nativeElement.dispatchEvent(new Event('input'));

      submitBtn.nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const errorBlock = fixture.debugElement.query(By.css('.error-block'));
      expect(errorBlock).toBeTruthy();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission & Authentication', () => {
    it('should authenticate, close dialog, and navigate to dashboard on valid submission', async () => {
      const emailInput = fixture.debugElement.query(By.css('input[type="email"]'));
      const passwordInput = fixture.debugElement.query(By.css('input[type="password"]'));
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));

      emailInput.nativeElement.value = 'valid.user@example.com';
      emailInput.nativeElement.dispatchEvent(new Event('input'));
      passwordInput.nativeElement.value = 'securePassword123';
      passwordInput.nativeElement.dispatchEvent(new Event('input'));

      submitBtn.nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockAuthService.signIn).toHaveBeenCalledWith({
        email: 'valid.user@example.com',
        password: 'securePassword123',
      });
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith([APP_LINKS.DASHBOARD]);
    });

    it('should render SpinnerIconComponent while sign-in request is submitting', async () => {
      let resolveSignIn: (() => void) | undefined;
      const signInPromise = new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      });
      mockAuthService.signIn.mockReturnValueOnce(signInPromise);

      const emailInput = fixture.debugElement.query(By.css('input[type="email"]'));
      const passwordInput = fixture.debugElement.query(By.css('input[type="password"]'));
      const submitBtn = fixture.debugElement.query(By.css('button[type="submit"]'));

      emailInput.nativeElement.value = 'valid.user@example.com';
      emailInput.nativeElement.dispatchEvent(new Event('input'));
      passwordInput.nativeElement.value = 'securePassword123';
      passwordInput.nativeElement.dispatchEvent(new Event('input'));

      submitBtn.nativeElement.click();
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.directive(SpinnerIconComponent));
      expect(spinner).toBeTruthy();
      expect(submitBtn.nativeElement.disabled).toBe(true);

      resolveSignIn?.();
      await fixture.whenStable();
      fixture.detectChanges();
    });
  });
});
