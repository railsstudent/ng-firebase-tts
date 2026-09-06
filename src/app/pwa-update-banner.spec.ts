import { PwaUpdateService } from '@/core/services/pwa-update.service';
import { PwaUpdateBanner } from '@/pwa-update-banner';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PwaUpdateBanner', () => {
  let updateAvailableSignal: WritableSignal<boolean>;
  let reloadPageSpy: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<PwaUpdateBanner>;

  beforeEach(async () => {
    updateAvailableSignal = signal(false);
    reloadPageSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PwaUpdateBanner],
      providers: [
        {
          provide: PwaUpdateService,
          useValue: {
            updateAvailable: updateAvailableSignal.asReadonly(),
            reloadPage: reloadPageSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PwaUpdateBanner);
  });

  it('should not render the banner when updateAvailable is false', () => {
    fixture.detectChanges();
    const banner = (fixture.nativeElement as HTMLElement).querySelector('.pwa-banner');
    expect(banner).toBeNull();
  });

  it('should render the banner and update message when updateAvailable is true', () => {
    updateAvailableSignal.set(true);
    fixture.detectChanges();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('.pwa-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('A new version is available!');
    expect(banner?.querySelector('button')?.textContent).toContain('Reload');
  });

  it('should dynamically show the banner when updateAvailable signal updates to true', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pwa-banner')).toBeNull();

    updateAvailableSignal.set(true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.pwa-banner')).not.toBeNull();
  });

  it('should trigger reloadPage() when the Reload button is clicked', () => {
    updateAvailableSignal.set(true);
    fixture.detectChanges();

    const reloadButton = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(reloadButton).not.toBeNull();
    reloadButton?.click();

    expect(reloadPageSpy).toHaveBeenCalledTimes(1);
  });
});
