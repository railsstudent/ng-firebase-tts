import { WINDOW } from '@/core/constants/navigator.const';
import { PWA_CHECK_INTERVAL } from '@/core/constants/pwa.constant';
import { PwaUpdateService } from '@/core/services/pwa-update.service';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

describe('PwaUpdateService', () => {
  let swUpdateMock: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionReadyEvent>;
    unrecoverable: Subject<UnrecoverableStateEvent>;
    activateUpdate: () => Promise<boolean>;
    checkForUpdate: ReturnType<typeof vi.fn>;
  };
  let appRefMock: {
    isStable: Subject<boolean>;
  };
  let windowMock: { location: { reload: () => void } } | null;
  let reloadCalled: boolean;
  let testCheckInterval: number;

  beforeEach(() => {
    reloadCalled = false;
    testCheckInterval = 1000;
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: new Subject<VersionReadyEvent>(),
      unrecoverable: new Subject<UnrecoverableStateEvent>(),
      activateUpdate: () => Promise.resolve(true),
      checkForUpdate: vi.fn().mockResolvedValue(true),
    };
    appRefMock = {
      isStable: new Subject<boolean>(),
    };
    windowMock = {
      location: {
        reload: () => {
          reloadCalled = true;
        },
      },
    };
  });

  function createService(intervalOverride?: number): PwaUpdateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PwaUpdateService,
        { provide: SwUpdate, useValue: swUpdateMock },
        { provide: ApplicationRef, useValue: appRefMock },
        { provide: WINDOW, useFactory: () => windowMock },
        { provide: PWA_CHECK_INTERVAL, useValue: intervalOverride ?? testCheckInterval },
      ],
    });
    return TestBed.inject(PwaUpdateService);
  }

  it('should initialize updateAvailable as false', () => {
    const service = createService();
    expect(service.updateAvailable()).toBe(false);
  });

  it('should emit true when window is present, SwUpdate is enabled, and VERSION_READY is fired', () => {
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(true);
  });

  it('should ignore other event types (e.g. VERSION_DETECTED)', () => {
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'v2' },
    } as unknown as VersionReadyEvent);
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when WINDOW is null (SSR)', () => {
    windowMock = null;
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when SwUpdate.isEnabled is false', () => {
    swUpdateMock.isEnabled = false;
    const service = createService();
    swUpdateMock.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(false);
  });

  it('should call window.location.reload() when reloadPage() is called in browser', async () => {
    const service = createService();
    await service.reloadPage();
    expect(reloadCalled).toBe(true);
  });

  it('should not call window.location.reload() when reloadPage() is called in SSR', async () => {
    windowMock = null;
    const service = createService();
    await service.reloadPage();
    expect(reloadCalled).toBe(false);
  });

  it('should handle errors when activateUpdate() rejects and still reload the page', async () => {
    swUpdateMock.activateUpdate = vi.fn().mockRejectedValueOnce(new Error('Activation failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

    const service = createService();
    await service.reloadPage();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to activate service worker update:', expect.any(Error));
    expect(reloadCalled).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  describe('Unrecoverable state handling', () => {
    it('should call window.location.reload() when an unrecoverable event is emitted in browser', () => {
      createService();
      swUpdateMock.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(true);
    });

    it('should not call window.location.reload() on unrecoverable event when WINDOW is null (SSR)', () => {
      windowMock = null;
      createService();
      swUpdateMock.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(false);
    });

    it('should not call window.location.reload() on unrecoverable event when SwUpdate.isEnabled is false', () => {
      swUpdateMock.isEnabled = false;
      createService();
      swUpdateMock.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(false);
    });
  });

  describe('Background update polling', () => {
    it('should call swUpdate.checkForUpdate() when ApplicationRef emits isStable=true in browser', async () => {
      createService();
      expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();

      appRefMock.isStable.next(true);
      await Promise.resolve();

      expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
    });

    it('should catch and handle errors from checkForUpdate() without crashing the service', async () => {
      swUpdateMock.checkForUpdate.mockRejectedValueOnce(new Error('Network offline'));
      createService();

      appRefMock.isStable.next(true);
      await Promise.resolve();

      expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
    });

    it('should not call swUpdate.checkForUpdate() when WINDOW is null (SSR)', async () => {
      windowMock = null;
      createService();

      appRefMock.isStable.next(true);
      await Promise.resolve();

      expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();
    });

    it('should not call swUpdate.checkForUpdate() when SwUpdate.isEnabled is false', async () => {
      swUpdateMock.isEnabled = false;
      createService();

      appRefMock.isStable.next(true);
      await Promise.resolve();

      expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();
    });

    it('should respect custom injected PWA_CHECK_INTERVAL', async () => {
      const customInterval = 5000;
      createService(customInterval);

      appRefMock.isStable.next(true);
      await Promise.resolve();

      expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
    });

    it('should perform periodic update checks on subsequent interval ticks', async () => {
      vi.useFakeTimers();
      try {
        createService(1000);
        appRefMock.isStable.next(true);
        await vi.advanceTimersByTimeAsync(0);

        expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(1);

        // Advance by 1 interval period
        await vi.advanceTimersByTimeAsync(1000);
        expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(2);

        // Advance by another interval period
        await vi.advanceTimersByTimeAsync(1000);
        expect(swUpdateMock.checkForUpdate).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
