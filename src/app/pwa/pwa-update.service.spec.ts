import { WINDOW } from '@/core/constants/navigator.const';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PwaUpdateService } from './pwa-update.service';
import { PWA_CHECK_INTERVAL } from './pwa.constant';

describe('PwaUpdateService', () => {
  let mockSwUpdate: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionReadyEvent>;
    unrecoverable: Subject<UnrecoverableStateEvent>;
    activateUpdate: () => Promise<boolean>;
    checkForUpdate: ReturnType<typeof vi.fn>;
  };
  let mockAppRef: {
    isStable: Subject<boolean>;
  };
  let mockWindow: { location: { reload: () => void } } | null;
  let reloadCalled: boolean;
  let testCheckInterval: number;

  beforeEach(() => {
    reloadCalled = false;
    testCheckInterval = 1000;
    mockSwUpdate = {
      isEnabled: true,
      versionUpdates: new Subject<VersionReadyEvent>(),
      unrecoverable: new Subject<UnrecoverableStateEvent>(),
      activateUpdate: () => Promise.resolve(true),
      checkForUpdate: vi.fn().mockResolvedValue(true),
    };
    mockAppRef = {
      isStable: new Subject<boolean>(),
    };
    mockWindow = {
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
        { provide: SwUpdate, useValue: mockSwUpdate },
        { provide: ApplicationRef, useValue: mockAppRef },
        { provide: WINDOW, useFactory: () => mockWindow },
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
    mockSwUpdate.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(true);
  });

  it('should ignore other event types (e.g. VERSION_DETECTED)', () => {
    const service = createService();
    mockSwUpdate.versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'v2' },
    } as unknown as VersionReadyEvent);
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when WINDOW is null (SSR)', () => {
    mockWindow = null;
    const service = createService();
    mockSwUpdate.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    });
    expect(service.updateAvailable()).toBe(false);
  });

  it('should not emit true when SwUpdate.isEnabled is false', () => {
    mockSwUpdate.isEnabled = false;
    const service = createService();
    mockSwUpdate.versionUpdates.next({
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
    mockWindow = null;
    const service = createService();
    await service.reloadPage();
    expect(reloadCalled).toBe(false);
  });

  it('should handle errors when activateUpdate() rejects and still reload the page', async () => {
    mockSwUpdate.activateUpdate = vi.fn().mockRejectedValueOnce(new Error('Activation failed'));
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
      mockSwUpdate.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(true);
    });

    it('should not call window.location.reload() on unrecoverable event when WINDOW is null (SSR)', () => {
      mockWindow = null;
      createService();
      mockSwUpdate.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(false);
    });

    it('should not call window.location.reload() on unrecoverable event when SwUpdate.isEnabled is false', () => {
      mockSwUpdate.isEnabled = false;
      createService();
      mockSwUpdate.unrecoverable.next({
        type: 'UNRECOVERABLE_STATE',
        reason: 'Corrupted hash chunk',
      });
      expect(reloadCalled).toBe(false);
    });
  });

  describe('Background update polling', () => {
    it('should call swUpdate.checkForUpdate() when ApplicationRef emits isStable=true in browser', async () => {
      createService();
      expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();

      mockAppRef.isStable.next(true);
      await Promise.resolve();

      expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
    });

    it('should catch and handle errors from checkForUpdate() without crashing the service', async () => {
      mockSwUpdate.checkForUpdate.mockRejectedValueOnce(new Error('Network offline'));
      createService();

      mockAppRef.isStable.next(true);
      await Promise.resolve();

      expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
    });

    it('should not call swUpdate.checkForUpdate() when WINDOW is null (SSR)', async () => {
      mockWindow = null;
      createService();

      mockAppRef.isStable.next(true);
      await Promise.resolve();

      expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
    });

    it('should not call swUpdate.checkForUpdate() when SwUpdate.isEnabled is false', async () => {
      mockSwUpdate.isEnabled = false;
      createService();

      mockAppRef.isStable.next(true);
      await Promise.resolve();

      expect(mockSwUpdate.checkForUpdate).not.toHaveBeenCalled();
    });

    it('should respect custom injected PWA_CHECK_INTERVAL', async () => {
      const customInterval = 5000;
      createService(customInterval);

      mockAppRef.isStable.next(true);
      await Promise.resolve();

      expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
    });

    it('should perform periodic update checks on subsequent interval ticks', async () => {
      vi.useFakeTimers();
      try {
        createService(1000);
        mockAppRef.isStable.next(true);
        await vi.advanceTimersByTimeAsync(0);

        expect(mockSwUpdate.checkForUpdate).toHaveBeenCalledTimes(1);

        // Advance by 1 interval period
        await vi.advanceTimersByTimeAsync(1000);
        expect(mockSwUpdate.checkForUpdate).toHaveBeenCalledTimes(2);

        // Advance by another interval period
        await vi.advanceTimersByTimeAsync(1000);
        expect(mockSwUpdate.checkForUpdate).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
