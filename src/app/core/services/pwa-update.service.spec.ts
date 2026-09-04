import { WINDOW } from '@/core/constants/navigator.const';
import { PwaUpdateService } from '@/core/services/pwa-update.service';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

describe('PwaUpdateService', () => {
  let swUpdateMock: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionReadyEvent>;
    activateUpdate: () => Promise<boolean>;
  };
  let windowMock: { location: { reload: () => void } } | null;
  let reloadCalled: boolean;

  beforeEach(() => {
    reloadCalled = false;
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: new Subject<VersionReadyEvent>(),
      activateUpdate: () => Promise.resolve(true),
    };
    windowMock = {
      location: {
        reload: () => {
          reloadCalled = true;
        },
      },
    };
  });

  function createService(): PwaUpdateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PwaUpdateService,
        { provide: SwUpdate, useValue: swUpdateMock },
        { provide: WINDOW, useFactory: () => windowMock },
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
});
